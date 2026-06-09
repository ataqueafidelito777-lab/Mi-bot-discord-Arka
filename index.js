const {
    Client, GatewayIntentBits, EmbedBuilder, PermissionFlagsBits,
    ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder,
    TextInputBuilder, TextInputStyle, StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder, ChannelType
} = require('discord.js');
const fs   = require('fs');
const path = require('path');
require('dotenv').config();

// ─── Validación temprana de TOKEN ─────────────────────────────────────────────
if (!process.env.TOKEN) {
    console.error('❌ FATAL: La variable de entorno TOKEN no está configurada.');
    console.error('   Configúrala en el panel de variables de entorno del hosting.');
    process.exit(1);
}

const BANNER_URL = 'https://i.imgur.com/RHLSmgM.png';

// ─── Emojis personalizados ────────────────────────────────────────────────────
const E = {
    reloj:    '<:Aurex_Reloj:1513372785727111278>',
    cerebro:  '<:Aurex_AiCerebro:1513372643728949278>',
    invoice:  '<:Aurex_Invoicemalhechoxd:1513372495695183872>',
    export:   '<:Aurex_Export:1513372369849290782>',
    settings: '<:Aurex_Settings:1513371533161005177>',
    roles:    '<:Aurex_Roles:1513371413254508675>',
    orders:   '<:Aurex_Orders:1513363677569486999>',
    analytics:'<:Aurex_Analytics:1513363579703787621>',
    review:   '<:Aurex_Review:1513362468133535764>',
    stats:    '<:Aurex_Stats:1513362232275243112>',
    stock:    '<:Aurex_Stock:1513361977219612745>',
    bot:      '<:Aurex_Bot:1513350718248058991>',
    money:    '<:Aurex_Money:1513350564094804032>',
    ticket:   '<:Aurex_Ticket:1513350401850871819>',
    carrito:  '🛒',
    tarjeta:  '💳',
    keycard:  '🪪',
    caja:     '📦',
    diamante: '💎',
    corona:   '👑',
    escudo:   '🛡️',
    campana:  '🔔',
    relojArena: '⏳',
    check:    '✅',
    cruz:     '❌',
    advertencia: '⚠️',
    flecha:   '➜',
    arrow:    '╰➤',
    arrowR:   '➜',
    dot:      '◆',
    line:     '▸',
};

const TIER_UMBRALES = [
    { nombre: 'bronce', minCompras: 1,  emoji: '🥉', label: 'Bronce' },
    { nombre: 'plata',  minCompras: 5,  emoji: '🥈', label: 'Plata'  },
    { nombre: 'oro',    minCompras: 10, emoji: '🥇', label: 'Oro'    },
    { nombre: 'vip',    minCompras: 20, emoji: '💎', label: 'VIP'    }
];

// ─── Persistencia ─────────────────────────────────────────────────────────────
const DATA_DIR = path.join(__dirname, 'data');
try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
} catch (e) {
    console.error('❌ FATAL: No se puede crear el directorio de datos:', e.message);
    process.exit(1);
}

// FIX #1: escritura atómica con fallback para filesystems que no soportan rename
function saveAtomic(filePath, data) {
    const tmp = filePath + '.tmp';
    try {
        fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
        try {
            fs.renameSync(tmp, filePath);
        } catch {
            fs.copyFileSync(tmp, filePath);
            try { fs.unlinkSync(tmp); } catch { /* no crítico */ }
        }
    } catch (e) {
        try { if (fs.existsSync(tmp)) fs.unlinkSync(tmp); } catch { /* ignorar */ }
        throw e;
    }
}

// ─── Carga/guardado RAW (internos, no usar directamente) ──────────────────────
function _loadDataRaw(guildId) {
    const file = path.join(DATA_DIR, `${guildId}.json`);
    if (!fs.existsSync(file)) return _defaultData();
    try {
        const raw = fs.readFileSync(file, 'utf8');
        if (!raw || !raw.trim()) return _defaultData();
        return JSON.parse(raw);
    } catch (e) {
        console.error(`❌ loadData [${guildId}]:`, e.message);
        const tmp = file + '.tmp';
        if (fs.existsSync(tmp)) {
            try {
                const rawTmp = fs.readFileSync(tmp, 'utf8');
                if (rawTmp && rawTmp.trim()) return JSON.parse(rawTmp);
            } catch { /* ignorar */ }
        }
        return _defaultData();
    }
}
function _loadTicketsRaw(guildId) {
    const file = path.join(DATA_DIR, `tickets_${guildId}.json`);
    if (!fs.existsSync(file)) return _defaultTickets();
    try {
        const raw = fs.readFileSync(file, 'utf8');
        if (!raw || !raw.trim()) return _defaultTickets();
        return JSON.parse(raw);
    } catch (e) {
        console.error(`❌ loadTickets [${guildId}]:`, e.message);
        const tmp = file + '.tmp';
        if (fs.existsSync(tmp)) {
            try {
                const rawTmp = fs.readFileSync(tmp, 'utf8');
                if (rawTmp && rawTmp.trim()) return JSON.parse(rawTmp);
            } catch { /* ignorar */ }
        }
        return _defaultTickets();
    }
}
function saveData(guildId, data) {
    try { saveAtomic(path.join(DATA_DIR, `${guildId}.json`), data); }
    catch (e) { console.error('❌ saveData:', e.message); }
}
function saveTickets(guildId, data) {
    try { saveAtomic(path.join(DATA_DIR, `tickets_${guildId}.json`), data); }
    catch (e) { console.error('❌ saveTickets:', e.message); }
}
function _defaultData() {
    return {
        ventas: [], resenas: [],
        config: { logChannelId: null, dmEnabled: true, resenaChannelId: null, dmCierreTexto: null, tierRoles: {}, vipRoleId: null },
        afk: {}, stock: [],
        analytics: { totalVentas: 0, totalRobux: 0, porVendedor: {}, porCliente: {} },
        sorteos: []
    };
}
function _defaultTickets() {
    return {
        tickets: [], cooldowns: {},
        config: { panelMessageId: null, panelChannelId: null, categoryId: null, logChannelId: null, vendedorRoleId: null, staffRoleId: null }
    };
}

// ─── Sanear datos al cargar (migración defensiva) ─────────────────────────────
function sanitizeData(data) {
    if (!data.ventas)                          data.ventas   = [];
    if (!data.resenas)                         data.resenas  = [];
    if (!data.afk)                             data.afk      = {};
    if (!data.stock)                           data.stock    = [];
    if (!data.sorteos)                         data.sorteos  = [];
    if (!data.config)                          data.config   = {};
    if (data.config.logChannelId    === undefined) data.config.logChannelId    = null;
    if (data.config.dmEnabled       === undefined) data.config.dmEnabled       = true;
    if (data.config.resenaChannelId === undefined) data.config.resenaChannelId = null;
    if (data.config.dmCierreTexto   === undefined) data.config.dmCierreTexto   = null;
    if (!data.config.tierRoles)                data.config.tierRoles = {};
    if (data.config.vipRoleId       === undefined) data.config.vipRoleId       = null;
    if (!data.analytics)                       data.analytics = {};
    if (!data.analytics.totalVentas)           data.analytics.totalVentas = 0;
    if (!data.analytics.totalRobux)            data.analytics.totalRobux  = 0;
    if (!data.analytics.porVendedor)           data.analytics.porVendedor = {};
    if (!data.analytics.porCliente)            data.analytics.porCliente  = {};
    return data;
}
function sanitizeTickets(data) {
    if (!data.tickets)                         data.tickets   = [];
    if (!data.cooldowns)                       data.cooldowns = {};
    if (!data.config)                          data.config    = {};
    const cfg = data.config;
    if (cfg.panelMessageId  === undefined) cfg.panelMessageId  = null;
    if (cfg.panelChannelId  === undefined) cfg.panelChannelId  = null;
    if (cfg.categoryId      === undefined) cfg.categoryId      = null;
    if (cfg.logChannelId    === undefined) cfg.logChannelId    = null;
    if (cfg.vendedorRoleId  === undefined) cfg.vendedorRoleId  = null;
    if (cfg.staffRoleId     === undefined) cfg.staffRoleId     = null;
    return data;
}

// FIX #1 APLICADO: loadData y loadTickets son directamente las versiones seguras.
// Todo el código usa estas funciones — nunca las RAW.
function loadData(guildId)    { return sanitizeData(_loadDataRaw(guildId));       }
function loadTickets(guildId) { return sanitizeTickets(_loadTicketsRaw(guildId)); }

// ─── Lock anti-doble ticket ───────────────────────────────────────────────────
const ticketLocks = new Set();

// ─── Manejo global de errores ─────────────────────────────────────────────────
function isIgnorableError(err) {
    if (!err) return true;
    const code = err.code ?? err.status;
    if ([10062, 40060, 10008, 10003, 50013, 50035].includes(code)) return true;
    const msg = (err.message ?? '').toLowerCase();
    if (msg.includes('unknown interaction'))   return true;
    if (msg.includes('unknown message'))       return true;
    if (msg.includes('cannot send messages'))  return true;
    if (msg.includes('missing access'))        return true;
    if (msg.includes('interaction has already been acknowledged')) return true;
    if (msg.includes('the user aborted a request')) return true;
    if (msg.includes('econnreset'))            return true;
    if (msg.includes('econnrefused'))          return true;
    if (msg.includes('etimedout'))             return true;
    return false;
}
process.on('unhandledRejection', (err) => {
    if (isIgnorableError(err)) return;
    console.error('❌ [unhandledRejection]', err?.message ?? err);
});
process.on('uncaughtException', (err) => {
    if (isIgnorableError(err)) return;
    console.error('❌ [uncaughtException]', err?.message ?? err);
});
process.on('warning', (warning) => {
    if (warning.name === 'MaxListenersExceededWarning') return;
    console.warn('⚠️ [NodeWarning]', warning.name, warning.message);
});

// ─── Helpers de interacción ───────────────────────────────────────────────────
async function safeReply(interaction, opts) {
    const normalized = { ...opts };
    if (normalized.ephemeral === true) { normalized.flags = 64; delete normalized.ephemeral; }
    if (!normalized.flags) normalized.flags = 64;
    try {
        if (interaction.replied)  return await interaction.followUp({ ...normalized });
        if (interaction.deferred) return await interaction.editReply(normalized);
        return await interaction.reply({ ...normalized });
    } catch (e) {
        if (!isIgnorableError(e)) console.warn('⚠️ [safeReply]', e?.message);
    }
}
async function safeReplyPublic(interaction, opts) {
    try {
        if (interaction.replied)  return await interaction.followUp(opts);
        if (interaction.deferred) return await interaction.editReply(opts);
        return await interaction.reply(opts);
    } catch (e) {
        if (!isIgnorableError(e)) console.warn('⚠️ [safeReplyPublic]', e?.message);
    }
}
async function safeDefer(interaction, ephemeral = false) {
    if (interaction.deferred || interaction.replied) return true;
    try {
        await interaction.deferReply(ephemeral ? { flags: 64 } : {});
        return true;
    } catch (e) {
        if (!isIgnorableError(e)) console.warn('⚠️ [safeDefer]', e?.message);
        return false;
    }
}
async function safeUpdate(interaction, opts) {
    try {
        if (interaction.replied || interaction.deferred) return await interaction.editReply(opts);
        return await interaction.update(opts);
    } catch (e) { if (!isIgnorableError(e)) console.warn('⚠️ safeUpdate:', e.message); }
}
async function safeHandle(interaction, fn) {
    try { await fn(); }
    catch (err) {
        if (isIgnorableError(err)) return;
        console.error(`❌ [safeHandle] ${interaction.commandName ?? interaction.customId ?? '?'}:`, err.message ?? err);
        const esFaltaPermisos = err.code === 50013
            || (err.message ?? '').toLowerCase().includes('missing permissions')
            || (err.message ?? '').toLowerCase().includes('missing access');
        await safeReply(interaction, {
            content: esFaltaPermisos
                ? '⚠️ **Faltan permisos.** El bot necesita: `Gestionar canales` `Gestionar roles` `Ver canales` `Enviar mensajes`.'
                : '⚠️ Ocurrió un error inesperado. Intenta de nuevo.'
        });
    }
}

// ─── Cooldowns ────────────────────────────────────────────────────────────────
const cooldownMap = new Map();
function checkCooldown(guildId, userId, comando, segundos) {
    const key = `${guildId}-${userId}-${comando}`;
    const ahora = Date.now();
    if (cooldownMap.has(key)) {
        const restante = Math.ceil((cooldownMap.get(key) + segundos * 1000 - ahora) / 1000);
        if (restante > 0) return restante;
    }
    cooldownMap.set(key, ahora);
    return 0;
}
setInterval(() => {
    const ahora = Date.now();
    for (const [key, ts] of cooldownMap)
        if (ahora - ts > 300_000) cooldownMap.delete(key);
}, 10 * 60 * 1000);

// ─── Utilidades ───────────────────────────────────────────────────────────────
const PREFIX = '$';
function parseRobux(str) {
    if (!str) return null;
    const s = String(str).toLowerCase().trim();
    if (s.endsWith('k')) { const n = parseFloat(s) * 1_000; return n > 0 ? Math.round(n) : null; }
    if (s.endsWith('m')) { const n = parseFloat(s) * 1_000_000; return n > 0 ? Math.round(n) : null; }
    const n = parseInt(s.replace(/,/g, ''), 10);
    return isNaN(n) || n <= 0 ? null : n;
}
function formatRobux(n) {
    if (!n || n === 0) return '0 R$';
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M R$`;
    if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}k R$`;
    return `${n} R$`;
}
function today() {
    return new Date().toLocaleString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function ventasPorRango(ventas, rango) {
    const ahora = Date.now();
    const rangos = { hoy: 86_400_000, semana: 604_800_000, mes: 2_592_000_000 };
    const limite = rangos[rango];
    if (!limite) return ventas; // rango desconocido → devuelve todo
    return ventas.filter(v => (ahora - v.timestamp) <= limite);
}
function tiempoRelativo(ms) {
    const min = Math.floor(ms / 60000); const hrs = Math.floor(min / 60); const dias = Math.floor(hrs / 24);
    if (dias > 0) return `${dias}d ${hrs % 24}h`; if (hrs > 0) return `${hrs}h ${min % 60}m`; return `${min}m`;
}
function estrellas(n) { return '⭐'.repeat(Math.min(Math.max(n, 0), 5)); }
function calcDuracion(start, end) { return tiempoRelativo(end - start); }
function getTier(compras) {
    let tier = null;
    for (const t of TIER_UMBRALES) { if (compras >= t.minCompras) tier = t; }
    return tier;
}
function esClienteVip(miembro, vipRoleId) {
    if (!vipRoleId || !miembro) return false;
    return miembro.roles.cache.has(vipRoleId);
}

// FIX #2: usar reduce en vez de Math.max(...array) para evitar stack overflow con arrays grandes
function nextVentaId(ventas) {
    return ventas.length
        ? ventas.reduce((max, v) => v.id > max ? v.id : max, 0) + 1
        : 1;
}
function nextTicketId(tickets) {
    return tickets.length
        ? tickets.reduce((max, t) => t.id > max ? t.id : max, 0) + 1
        : 1;
}

// FIX #9: helper de timeout para DMs masivos
function withTimeout(promise, ms) {
    return Promise.race([
        promise,
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error('timeout')), ms)
        )
    ]);
}

// ─── Tier: asigna Y degrada roles según compras actuales (FIX #8) ─────────────
async function actualizarTier(guild, userId, comprasTotal, tierRoles) {
    if (!tierRoles || Object.keys(tierRoles).length === 0) return;
    try {
        const miembro = guild.members.cache.get(userId)
            ?? await guild.members.fetch(userId).catch(() => null);
        if (!miembro) return;

        const tierActual = getTier(comprasTotal); // null si < 1 compra

        for (const t of TIER_UMBRALES) {
            const roleId    = tierRoles[t.nombre];
            if (!roleId) continue;
            const debeTener = tierActual?.nombre === t.nombre;
            const laTiene   = miembro.roles.cache.has(roleId);

            if (debeTener && !laTiene) {
                await miembro.roles.add(roleId).catch(() => {});
                console.log(`🎖️ Tier [${t.label}] asignado → ${miembro.user.tag} en ${guild.name}`);
            } else if (!debeTener && laTiene) {
                await miembro.roles.remove(roleId).catch(() => {});
                console.log(`🎖️ Tier [${t.label}] removido → ${miembro.user.tag} en ${guild.name}`);
            }
        }
    } catch (err) { console.warn('⚠️ No se pudo actualizar tier:', err?.message); }
}

async function enviarDM(user, embed, extra = {}) {
    try { await user.send({ embeds: [embed], ...extra }); return true; }
    catch { console.warn(`⚠️ DM bloqueado: ${user.tag}`); return false; }
}

// ─── Embeds de ventas ─────────────────────────────────────────────────────────
function buildLogEmbed(venta, n) {
    return new EmbedBuilder().setColor('#5865F2')
        .setTitle(`${E.orders}  Nueva orden registrada`)
        .setDescription(
            `${E.arrowR} **\`#${n}\`** — ${venta.producto}\n\n` +
            `${E.arrow} ${E.money} **Cantidad:** \`${formatRobux(venta.robux)}\`\n` +
            `${E.arrow} 💵 **Precio:**   \`${venta.precio ?? 'No especificado'}\`\n` +
            `${E.arrow} ${E.tarjeta} **Método:**   \`${venta.metodo}\`\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `${E.arrow} 👤 **Cliente:**  <@${venta.clienteId}>\n` +
            `${E.arrow} 🤝 **Operador:** <@${venta.vendedorId}>`
        ).setFooter({ text: `Aurex • ${today()}` }).setTimestamp();
}
function buildDMVentaEmbed(venta, n, guildName, guildIconURL) {
    return new EmbedBuilder().setColor('#57F287')
        .setAuthor({ name: guildName, iconURL: guildIconURL ?? undefined })
        .setTitle(`${E.check}  ¡Pedido confirmado!`)
        .setThumbnail(guildIconURL ?? null)
        .setDescription(
            `¡Hola! Tu pedido fue procesado exitosamente 🎉\n\n` +
            `${E.arrow} ${E.caja} **Producto** \`${venta.producto}\`\n` +
            `${E.arrow} ${E.money} **Cantidad** \`${formatRobux(venta.robux)}\`\n` +
            `${E.arrow} 💵 **Precio** \`${venta.precio ?? 'No especificado'}\`\n` +
            `${E.arrow} ${E.tarjeta} **Método** \`${venta.metodo}\`\n` +
            `${E.arrow} ${E.orders} **Orden #** \`${n}\`\n\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `*Guarda tu número de orden para cualquier consulta.*\n` +
            `*¿Problema con tu pedido? Abre un ticket de soporte.*`
        ).setFooter({ text: `${guildName} · powered by Aurex` }).setTimestamp();
}
function buildVentaPublicaEmbed(venta, n) {
    return new EmbedBuilder().setColor('#5865F2')
        .setTitle(`${E.orders}  Orden \`#${n}\``)
        .setDescription(
            `${E.arrow} ${E.caja} **Producto** \`${venta.producto}\`\n` +
            `${E.arrow} ${E.money} **Cantidad** \`${formatRobux(venta.robux)}\`\n` +
            `${E.arrow} 💵 **Precio** \`${venta.precio ?? 'No especificado'}\`\n` +
            `${E.arrow} ${E.tarjeta} **Método** \`${venta.metodo}\`\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `${E.arrow} 👤 **Cliente** <@${venta.clienteId}>\n` +
            `${E.arrow} 🤝 **Operador** <@${venta.vendedorId}>`
        ).setFooter({ text: `${E.check} Registrado • ${today()} • Aurex` }).setTimestamp();
}

// ─── Sistema de Help ──────────────────────────────────────────────────────────
const HELP_CATEGORIAS = {
    pedidos: {
        emoji: '💸', label: 'Pedidos',
        embed: () => new EmbedBuilder().setColor('#5865F2').setTitle(`${E.orders}  Pedidos`)
            .setDescription(
                `${E.arrowR} Comandos para registrar y gestionar ventas.\n\n` +
                `**\`/vender\`**\n${E.arrow} Registra una nueva venta.\n\n` +
                `**\`/orden [id]\`**\n${E.arrow} Detalle completo de una orden.\n\n` +
                `**\`/historial\`**\n${E.arrow} Lista los últimos pedidos.\n\n` +
                `**\`/buscar [cliente]\`**\n${E.arrow} Todos los pedidos de un cliente.\n\n` +
                `**\`/cancelar [orden]\`**\n${E.arrow} Cancela una orden con confirmación.\n\n` +
                `**\`/exportar\`**\n${E.arrow} Descarga un .txt con pedidos del período.\n\n` +
                `**\`/factura [orden]\`**\n${E.arrow} Envía comprobante por DM al cliente.`
            ).setFooter({ text: 'Aurex • /help • Pedidos' }).setTimestamp()
    },
    analiticas: {
        emoji: '📊', label: 'Analíticas',
        embed: () => new EmbedBuilder().setColor('#FEE75C').setTitle(`${E.analytics}  Analíticas`)
            .setDescription(
                `${E.arrowR} Estadísticas y métricas de tu tienda.\n\n` +
                `**\`/stats\`**\n${E.arrow} Pedidos y R$ por período.\n\n` +
                `**\`/top\`**\n${E.arrow} Ranking de operadores o clientes.\n\n` +
                `**\`/dashboard\`**\n${E.arrow} Resumen visual completo.\n\n` +
                `**\`/servidor-stats\`**\n${E.arrow} Tarjeta completa del servidor.\n\n` +
                `**\`/perfil [usuario]\`**\n${E.arrow} Estadísticas completas de un usuario.`
            ).setFooter({ text: 'Aurex • /help • Analíticas' }).setTimestamp()
    },
    stock: {
        emoji: '📦', label: 'Stock',
        embed: () => new EmbedBuilder().setColor('#57F287').setTitle(`${E.stock}  Stock`)
            .setDescription(
                `${E.arrowR} Gestión de inventario.\n\n` +
                `**\`/stock\`**\n${E.arrow} Muestra ítems disponibles.\n\n` +
                `**\`/stock-admin [accion]\`**\n${E.arrow} Agrega, edita, elimina o limpia ítems.\n\n` +
                `**\`/stock-bulk\`**\n${E.arrow} Carga varios ítems desde un modal.\n` +
                `${E.arrow} Formato: \`Nombre | cantidad | precio | notas\``
            ).setFooter({ text: 'Aurex • /help • Stock' }).setTimestamp()
    },
    reputacion: {
        emoji: '⭐', label: 'Reputación',
        embed: () => new EmbedBuilder().setColor('#FEE75C').setTitle(`${E.review}  Reputación`)
            .setDescription(
                `${E.arrowR} Sistema de valoraciones.\n\n` +
                `**\`/reseña [orden]\`**\n${E.arrow} Califica del 1 al 5 una orden que realizaste.\n${E.arrow} Puedes adjuntar una imagen como prueba.\n\n` +
                `**\`/resenas [vendedor]\`**\n${E.arrow} Ver promedio y últimas valoraciones.`
            ).setFooter({ text: 'Aurex • /help • Reputación' }).setTimestamp()
    },
    tickets: {
        emoji: '🎫', label: 'Tickets',
        embed: () => new EmbedBuilder().setColor('#3498DB').setTitle(`${E.ticket}  Tickets`)
            .setDescription(
                `${E.arrowR} Sistema de atención al cliente.\n\n` +
                `**\`/ticket-setup\`**\n${E.arrow} Envía el panel de tickets.\n\n` +
                `**Tipos:** ${E.carrito} Comprar · 🎧 Soporte · ${E.advertencia} Reporte · ℹ️ Otros\n\n` +
                `${E.arrow} ${E.relojArena} Cooldown de **5 minutos** entre tickets.\n` +
                `${E.arrow} 📋 Transcript automático al cerrar.\n` +
                `${E.arrow} ${E.campana} Recordatorio al staff si hay >60 min sin respuesta.`
            ).setFooter({ text: 'Aurex • /help • Tickets' }).setTimestamp()
    },
    utilidades: {
        emoji: '🔧', label: 'Utilidades',
        embed: () => new EmbedBuilder().setColor('#95A5A6').setTitle(`${E.bot}  Utilidades`)
            .setDescription(
                `${E.arrowR} Herramientas generales.\n\n` +
                `**\`/afk [motivo]\`**\n${E.arrow} Activa el modo AFK. Registra menciones y mensajes.\n\n` +
                `**\`/anuncio\`**\n${E.arrow} Envía un anuncio con embed e imagen opcional.\n\n` +
                `**\`/notificar\`**\n${E.arrow} DM masivo a clientes registrados.\n\n` +
                `**\`/sorteo\`**\n${E.arrow} Crea un sorteo. VIPs tienen doble entrada.\n` +
                `${E.arrow} Solo el host puede finalizar o hacer reroll.\n\n` +
                `**\`/clear [cantidad]\`**\n${E.arrow} Borra hasta 100 mensajes.\n\n` +
                `**\`/ping\`**\n${E.arrow} Latencia actual del bot.\n\n` +
                `**Prefijo \`$\`:**\n${E.arrow} \`$ping\` · \`$help\` · \`$reroll <id>\``
            ).setFooter({ text: 'Aurex • /help • Utilidades' }).setTimestamp()
    },
    config: {
        emoji: '⚙️', label: 'Configuración',
        embed: () => new EmbedBuilder().setColor('#ED4245').setTitle(`${E.settings}  Configuración`)
            .setDescription(
                `${E.arrowR} Solo administradores.\n\n` +
                `**\`/setlog\`** · **\`/setresenas\`** · **\`/configdm\`** · **\`/setdm\`**\n\n` +
                `**\`/settiers\`**\n${E.arrow} Roles por número de compras.\n\n` +
                `**\`/setvip [rol]\`**\n${E.arrow} Define el rol VIP para doble entrada en sorteos.`
            ).setFooter({ text: 'Aurex • /help • Configuración' }).setTimestamp()
    }
};

function buildHelpInicio(guild) {
    return new EmbedBuilder().setColor('#5865F2')
        .setAuthor({ name: 'Aurex Bot', iconURL: client.user?.displayAvatarURL() ?? undefined })
        .setTitle(`${E.bot}  Panel de ayuda`)
        .setDescription(
            `${E.arrowR} Bienvenido al sistema de ayuda de **Aurex**.\n${E.arrow} Selecciona una categoría con los botones de abajo.\n\n` +
            `${E.orders} **Pedidos** — Registrar y gestionar ventas\n` +
            `${E.analytics} **Analíticas** — Stats, rankings y dashboard\n` +
            `${E.stock} **Stock** — Inventario de tu tienda\n` +
            `${E.review} **Reputación** — Reseñas y valoraciones\n` +
            `${E.ticket} **Tickets** — Atención al cliente\n` +
            `${E.bot} **Utilidades** — Herramientas generales\n` +
            `${E.settings} **Configuración** — Ajustes del servidor`
        )
        .setThumbnail(guild?.iconURL({ dynamic: true }) ?? null)
        .setFooter({ text: `Aurex • ${guild?.name ?? ''} · Usa los botones para navegar` })
        .setTimestamp();
}

function buildHelpRows() {
    const keys = Object.keys(HELP_CATEGORIAS);
    const row1 = new ActionRowBuilder().addComponents(
        keys.slice(0, 4).map(k => {
            const cat = HELP_CATEGORIAS[k];
            return new ButtonBuilder().setCustomId(`help_cat_${k}`).setLabel(cat.label).setEmoji(cat.emoji).setStyle(ButtonStyle.Secondary);
        })
    );
    const row2 = new ActionRowBuilder().addComponents(
        ...keys.slice(4).map(k => {
            const cat = HELP_CATEGORIAS[k];
            return new ButtonBuilder().setCustomId(`help_cat_${k}`).setLabel(cat.label).setEmoji(cat.emoji).setStyle(ButtonStyle.Secondary);
        }),
        new ButtonBuilder().setCustomId('help_inicio').setLabel('Inicio').setEmoji('🏠').setStyle(ButtonStyle.Primary)
    );
    return [row1, row2];
}

// ─── Tickets ──────────────────────────────────────────────────────────────────
const TICKET_COOLDOWN_MS = 5 * 60 * 1000;

const CATEGORIAS = {
    comprar: {
        emoji: '🛒', label: 'Comprar', descripcion: '¿Estás interesado en adquirir nuestros productos o servicios?',
        prefijo: 'compra', color: '#57F287',
        bienvenida: (u) =>
            `### ${E.carrito}  Ticket de Compra\n` +
            `${E.arrowR} ¡Hola, **${u}**! Bienvenido a tu ticket de compra.\n` +
            `${E.arrow} Un operador te atenderá en breve.\n\n` +
            `**📋 Para agilizar tu pedido, cuéntanos:**\n` +
            `${E.line} ${E.money} ¿Qué cantidad deseas adquirir?\n` +
            `${E.line} 💵 ¿Cuál es tu presupuesto?\n` +
            `${E.line} ${E.tarjeta} ¿Cuál es tu método de pago?\n` +
            `${E.line} 🌎 ¿De qué país eres?`,
        modal: true
    },
    soporte: {
        emoji: '🎧', label: 'Soporte', descripcion: '¿Tienes alguna duda, problema o inconveniente que necesite atención?',
        prefijo: 'soporte', color: '#3498DB',
        bienvenida: (u) =>
            `### 🎧  Ticket de Soporte\n` +
            `${E.arrowR} ¡Hola, **${u}**! Abriste un ticket de soporte.\n` +
            `${E.arrow} Nuestro equipo revisará tu caso lo antes posible.\n\n` +
            `**📋 Para ayudarte mejor:**\n` +
            `${E.line} ❓ ¿Qué ocurrió exactamente?\n` +
            `${E.line} ${E.orders} ¿Tienes número de orden?\n` +
            `${E.line} 📸 ¿Tienes capturas de pantalla?`,
        modal: false
    },
    reporte: {
        emoji: '⚠️', label: 'Reporte', descripcion: '¿Necesitas reportar algo o a alguien?',
        prefijo: 'reporte', color: '#ED4245',
        bienvenida: (u) =>
            `### ⚠️  Ticket de Reporte\n` +
            `${E.arrowR} ¡Hola, **${u}**! Recibimos tu reporte.\n` +
            `${E.arrow} El staff lo revisará con seriedad.\n\n` +
            `**📋 Necesitamos:**\n` +
            `${E.line} 👤 Usuario reportado\n` +
            `${E.line} 📝 Motivo detallado\n` +
            `${E.line} 📸 Evidencia\n` +
            `${E.line} 📅 ¿Cuándo ocurrió?`,
        modal: false
    },
    otros: {
        emoji: 'ℹ️', label: 'Otros', descripcion: '¿Tienes alguna otra consulta o mensaje para nosotros?',
        prefijo: 'otros', color: '#95A5A6',
        bienvenida: (u) =>
            `### ℹ️  Ticket General\n` +
            `${E.arrowR} ¡Hola, **${u}**! Abriste un ticket de consulta general.\n` +
            `${E.arrow} Un miembro del staff te atenderá en breve.\n\n` +
            `**📋 Cuéntanos:**\n` +
            `${E.line} ✏️ ¿En qué podemos ayudarte hoy?`,
        modal: false
    }
};

function buildPanelEmbed(guildName) {
    return new EmbedBuilder().setColor('#5865F2')
        .setTitle(`${E.ticket}  ¿En qué podemos ayudarte?`)
        .setDescription(
            `${E.arrowR} Selecciona la opción que mejor se ajuste a tu necesidad.\n\n` +
            `${E.carrito}  **Comprar**\n${E.arrow} ¿Estás interesado en adquirir nuestros productos o servicios?\n\n` +
            `🎧  **Soporte**\n${E.arrow} ¿Tienes alguna duda, problema o inconveniente que necesite atención?\n\n` +
            `⚠️  **Reporte**\n${E.arrow} ¿Necesitas reportar algo o a alguien?\n\n` +
            `ℹ️  **Otros**\n${E.arrow} ¿Tienes alguna otra consulta o mensaje para nosotros?`
        )
        .setImage(BANNER_URL).setFooter({ text: `${guildName} · powered by Aurex` }).setTimestamp();
}
function buildPanelRow() {
    return new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder().setCustomId('ticket_categoria').setPlaceholder('╰➤  Selecciona una opción...')
            .addOptions(Object.entries(CATEGORIAS).map(([key, cat]) =>
                new StringSelectMenuOptionBuilder().setLabel(cat.label).setDescription(cat.descripcion).setEmoji(cat.emoji).setValue(key)
            ))
    );
}

async function logTicket(guild, tdata, embedLog, archivo = null) {
    if (!tdata.config.logChannelId) return;
    try {
        const canal = guild.channels.cache.get(tdata.config.logChannelId)
            ?? await guild.channels.fetch(tdata.config.logChannelId).catch(() => null);
        if (!canal) return;
        await canal.send({ embeds: [embedLog], ...(archivo ? { files: [archivo] } : {}) }).catch(() => {});
    } catch (err) { console.warn('⚠️ Log ticket:', err?.message); }
}

async function handleTicketSetup(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator))
        return safeReply(interaction, { content: '🚫 Solo administradores.' });
    const ok = await safeDefer(interaction, true);
    if (!ok) return;
    const tdata            = loadTickets(interaction.guild.id);
    const canal            = interaction.options.getChannel('canal');
    const categoriaDiscord = interaction.options.getChannel('categoria') ?? null;
    const logCanal         = interaction.options.getChannel('logs')      ?? null;
    const vendedorRol      = interaction.options.getRole('rol_vendedor') ?? null;
    const staffRol         = interaction.options.getRole('rol_staff')    ?? null;
    tdata.config.categoryId     = categoriaDiscord?.id ?? tdata.config.categoryId;
    tdata.config.logChannelId   = logCanal?.id         ?? tdata.config.logChannelId;
    tdata.config.vendedorRoleId = vendedorRol?.id      ?? tdata.config.vendedorRoleId;
    tdata.config.staffRoleId    = staffRol?.id         ?? tdata.config.staffRoleId;
    const embedPanel = buildPanelEmbed(interaction.guild.name);
    const rowPanel   = buildPanelRow();
    let panelActualizado = false;
    if (tdata.config.panelMessageId && tdata.config.panelChannelId) {
        try {
            const canalAnterior = await interaction.guild.channels.fetch(tdata.config.panelChannelId).catch(() => null);
            if (canalAnterior) {
                const mensajeAnterior = await canalAnterior.messages.fetch(tdata.config.panelMessageId).catch(() => null);
                if (mensajeAnterior) {
                    if (canalAnterior.id === canal.id) {
                        await mensajeAnterior.edit({ embeds: [embedPanel], components: [rowPanel] });
                        panelActualizado = true;
                    } else {
                        await mensajeAnterior.delete().catch(() => {});
                    }
                }
            }
        } catch { panelActualizado = false; }
    }
    if (!panelActualizado) {
        const msg = await canal.send({ embeds: [embedPanel], components: [rowPanel] }).catch(() => null);
        if (msg) {
            tdata.config.panelMessageId = msg.id;
            tdata.config.panelChannelId = canal.id;
        }
    }
    saveTickets(interaction.guild.id, tdata);
    return interaction.editReply({ content: [
        `✅ Panel ${panelActualizado ? 'actualizado' : `enviado a <#${canal.id}>`}`,
        categoriaDiscord ? `📁 Categoría: **${categoriaDiscord.name}**` : '',
        logCanal         ? `📋 Logs: <#${logCanal.id}>`                 : '',
        vendedorRol      ? `💼 Rol vendedor: <@&${vendedorRol.id}>`     : '',
        staffRol         ? `${E.escudo} Rol staff: <@&${staffRol.id}>`  : ''
    ].filter(Boolean).join('\n') });
}

// ─── Apertura de ticket ───────────────────────────────────────────────────────
async function abrirTicket(interaction, categoriaKey, datosModal = null) {
    const guild = interaction.guild;
    const user  = interaction.user;
    const cat   = CATEGORIAS[categoriaKey];

    if (!cat) return safeReply(interaction, { content: '⚠️ Categoría de ticket no válida.' });

    const lockKey = `${guild.id}-${user.id}`;
    if (ticketLocks.has(lockKey))
        return safeReply(interaction, { content: `${E.relojArena} Ya se está procesando tu ticket, espera un momento...` });
    ticketLocks.add(lockKey);

    try {
        const tdata = loadTickets(guild.id);

        // ¿Ticket ya abierto?
        const ticketAbierto = tdata.tickets.find(t => t.userId === user.id && t.estado === 'abierto');
        if (ticketAbierto) {
            const existe = await guild.channels.fetch(ticketAbierto.channelId).catch(() => null);
            if (existe) return safeReply(interaction, { content: `⚠️ Ya tienes un ticket abierto: <#${ticketAbierto.channelId}>` });
            ticketAbierto.estado = 'cerrado';
            ticketAbierto.cerradoPor = 'Sistema (canal eliminado)';
            ticketAbierto.cerradoAt = Date.now();
            saveTickets(guild.id, tdata);
        }

        // Cooldown
        const ultimoTicket = tdata.cooldowns[user.id] ?? 0;
        const restante = TICKET_COOLDOWN_MS - (Date.now() - ultimoTicket);
        if (restante > 0 && ultimoTicket > 0)
            return safeReply(interaction, { content: `${E.relojArena} Espera **${Math.ceil(restante / 60000)} min** antes de abrir otro ticket.` });

        // Permisos del bot
        if (!guild.members.me.permissions.has(PermissionFlagsBits.ManageChannels))
            return safeReply(interaction, { content: '⚠️ **Faltan permisos.** El bot necesita **Gestionar canales**.' });

        // Crear canal
        const nombreCanal = `${cat.prefijo}-${user.username.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20) || 'usuario'}`;
        const permisos = [
            { id: guild.id,               deny:  [PermissionFlagsBits.ViewChannel] },
            { id: user.id,                allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
            { id: guild.members.me.id,    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageMessages, PermissionFlagsBits.ManageChannels] }
        ];
        if (tdata.config.staffRoleId)    permisos.push({ id: tdata.config.staffRoleId,    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageMessages] });
        if (categoriaKey === 'comprar' && tdata.config.vendedorRoleId) permisos.push({ id: tdata.config.vendedorRoleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] });

        const canalTicket = await guild.channels.create({
            name: nombreCanal,
            type: ChannelType.GuildText,
            parent: tdata.config.categoryId ?? null,
            permissionOverwrites: permisos
        });

        const ticketId = nextTicketId(tdata.tickets);
        tdata.tickets.push({
            id: ticketId,
            channelId: canalTicket.id,
            userId: user.id,
            userTag: user.tag,
            categoria: categoriaKey,
            estado: 'abierto',
            timestamp: Date.now(),
            datosModal,
            ultimaActividad: Date.now(),
            recordatorioEnviado: false
        });
        tdata.cooldowns[user.id] = Date.now();
        saveTickets(guild.id, tdata);

        let descripcion = cat.bienvenida(user.username);
        if (datosModal) {
            descripcion +=
                `\n\n**📋 Datos de tu pedido:**\n` +
                `${E.arrow} ${E.money} **Cantidad:**    \`${datosModal.cantidad}\`\n` +
                `${E.arrow} 💵 **Presupuesto:** \`${datosModal.precio}\`\n` +
                `${E.arrow} ${E.tarjeta} **Método:**      \`${datosModal.metodo}\``;
        }
        const embedBienvenida = new EmbedBuilder()
            .setColor(cat.color)
            .setImage(BANNER_URL)
            .setDescription(descripcion)
            .setFooter({ text: `${E.ticket} Ticket #${ticketId} • ${guild.name} · Aurex` })
            .setTimestamp();
        const rowCerrar = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`ticket_cerrar_${ticketId}`).setLabel('🔒 Cerrar ticket').setStyle(ButtonStyle.Danger)
        );
        const menciones = [`<@${user.id}>`];
        if (categoriaKey === 'comprar' && tdata.config.vendedorRoleId) menciones.push(`<@&${tdata.config.vendedorRoleId}>`);
        else if (tdata.config.staffRoleId) menciones.push(`<@&${tdata.config.staffRoleId}>`);

        await canalTicket.send({ content: menciones.join(' '), embeds: [embedBienvenida], components: [rowCerrar] }).catch(() => {});

        await logTicket(guild, tdata, new EmbedBuilder().setColor('#57F287')
            .setTitle(`${E.ticket}  Ticket #${ticketId} abierto`)
            .setDescription(
                `${E.arrow} 👤 **Usuario:**   <@${user.id}> (\`${user.tag}\`)\n` +
                `${E.arrow} 🗂️ **Categoría:** ${cat.emoji} \`${cat.label}\`\n` +
                `${E.arrow} 📌 **Canal:**     <#${canalTicket.id}>`
            ).setTimestamp());

        return safeReply(interaction, { content: `${E.check} Tu ticket fue creado: <#${canalTicket.id}>` });

    } finally {
        ticketLocks.delete(lockKey);
    }
}

async function cerrarTicket(interaction, ticketId) {
    const guild  = interaction.guild;
    const tdata  = loadTickets(guild.id);
    const ticket = tdata.tickets.find(t => t.id === ticketId);
    if (!ticket || ticket.estado === 'cerrado')
        return safeReply(interaction, { content: '⚠️ Este ticket ya fue cerrado.' });
    const esAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
    const esStaff = tdata.config.staffRoleId ? interaction.member.roles.cache.has(tdata.config.staffRoleId) : false;
    if (!esAdmin && !esStaff && interaction.user.id !== ticket.userId)
        return safeReply(interaction, { content: '🚫 Sin permiso para cerrar este ticket.' });
    const ok = await safeDefer(interaction);
    if (!ok) return;

    // FIX #6: Transcript paginado que incluye mensajes de bots
    let todosLosMensajes = [];
    let before = undefined;
    while (true) {
        const batch = await interaction.channel.messages.fetch({ limit: 100, ...(before ? { before } : {}) }).catch(() => null);
        if (!batch || batch.size === 0) break;
        todosLosMensajes.push(...batch.values());
        before = batch.last().id;
        if (batch.size < 100) break;
    }
    todosLosMensajes.reverse();

    const closedAt = Date.now();
    const cat = CATEGORIAS[ticket.categoria] ?? { emoji: '🎫', label: 'Ticket' };
    const duracion = calcDuracion(ticket.timestamp, closedAt);

    let transcript = `TRANSCRIPT — Ticket #${ticket.id} (${cat.label})\nUsuario: ${ticket.userTag}\nCerrado por: ${interaction.user.tag}\nFecha: ${new Date(closedAt).toLocaleString('es-MX')}\nDuración: ${duracion}\n${'─'.repeat(60)}\n\n`;

    // FIX #6: incluir mensajes de bots con prefijo [BOT]
    todosLosMensajes.forEach(m => {
        const prefix = m.author.bot ? '[BOT] ' : '';
        const linea  = `[${new Date(m.createdTimestamp).toLocaleString('es-MX')}] ${prefix}${m.author.tag}`;
        if (m.content) transcript += `${linea}: ${m.content}\n`;
        if (m.embeds.length > 0) {
            m.embeds.forEach((emb, i) => {
                transcript += `${linea} [embed${i + 1}]: ${emb.title ?? '(sin título)'}\n`;
                if (emb.description) transcript += `  └ ${emb.description.slice(0, 200)}\n`;
            });
        }
    });

    ticket.estado     = 'cerrado';
    ticket.cerradoPor = interaction.user.tag;
    ticket.cerradoAt  = closedAt;
    saveTickets(guild.id, tdata);

    await interaction.editReply({ embeds: [new EmbedBuilder().setColor('#ED4245').setTitle('🔒  Ticket cerrado')
        .setDescription(
            `${E.arrow} Cerrado por <@${interaction.user.id}>\n` +
            `${E.arrow} El canal se eliminará en **5 segundos**.`
        ).setTimestamp()] }).catch(() => {});

    // DM al usuario con transcript
    try {
        const gdata = loadData(guild.id);
        const dmTexto = gdata.config.dmCierreTexto
            ?? `¡Hola, **{usuario}**! 👋\n\nEsperamos haberte atendido de la mejor manera en **{servidor}**.\n\n*Si tuviste algún inconveniente, abre un nuevo ticket.*\n\n¡Gracias por confiar en nosotros! 💙`;
        const buffer = Buffer.from(transcript, 'utf8');
        const miembro = await guild.members.fetch(ticket.userId).catch(() => null);
        if (miembro) {
            const embedDM = new EmbedBuilder().setColor('#5865F2')
                .setAuthor({ name: guild.name, iconURL: guild.iconURL({ dynamic: true }) ?? undefined })
                .setTitle(`${E.ticket}  Tu ticket fue cerrado`)
                .setThumbnail(guild.iconURL({ dynamic: true }) ?? null)
                .setDescription(
                    `${E.arrow} **Servidor:**    \`${guild.name}\`\n` +
                    `${E.arrow} **Categoría:**   ${cat.emoji} \`${cat.label}\`\n` +
                    `${E.arrow} **Cerrado por:** \`${interaction.user.tag}\`\n` +
                    `${E.arrow} **Duración:**    \`${duracion}\`\n\n` +
                    `━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                    dmTexto.replace('{usuario}', ticket.userTag.split('#')[0]).replace('{servidor}', guild.name)
                ).setFooter({ text: `${guild.name} · powered by Aurex` }).setTimestamp();
            await enviarDM(miembro.user, embedDM, { files: [{ attachment: buffer, name: `transcript-ticket${ticketId}.txt` }] });
        }
    } catch (e) { console.warn('⚠️ DM cierre fallido:', e?.message); }

    const bufferLog = Buffer.from(transcript, 'utf8');
    await logTicket(guild, tdata,
        new EmbedBuilder().setColor('#ED4245').setTitle(`${E.ticket}  Ticket #${ticketId} cerrado`)
            .setDescription(
                `${E.arrow} 👤 **Usuario:**    <@${ticket.userId}> (\`${ticket.userTag}\`)\n` +
                `${E.arrow} 🗂️ **Categoría:**  ${cat.emoji} \`${cat.label}\`\n` +
                `${E.arrow} 🔒 **Cerrado por:** \`${interaction.user.tag}\`\n` +
                `${E.arrow} ⏱️ **Duración:**   \`${duracion}\``
            ).setTimestamp(),
        { attachment: bufferLog, name: `transcript-ticket${ticketId}.txt` }
    );
    setTimeout(() => { interaction.channel.delete().catch(() => {}); }, 5000);
}

async function handleTicketInteraction(interaction) {
    if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_categoria') {
        const categoriaKey = interaction.values[0];
        const cat = CATEGORIAS[categoriaKey];
        if (!cat) return safeReply(interaction, { content: '⚠️ Categoría no válida.' });
        if (cat.modal) {
            const modal = new ModalBuilder()
                .setCustomId(`ticket_modal_${categoriaKey}`)
                .setTitle(`Ticket — ${cat.label}`);
            modal.addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder().setCustomId('cantidad').setLabel('¿Cuánto deseas adquirir?').setPlaceholder('Ej: 1000, 5k').setStyle(TextInputStyle.Short).setRequired(true)
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder().setCustomId('precio').setLabel('¿Cuál es tu presupuesto?').setPlaceholder('Ej: $5 USD, 130 MXN').setStyle(TextInputStyle.Short).setRequired(true)
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder().setCustomId('metodo').setLabel('¿Método de pago?').setPlaceholder('Ej: PayPal, Binance, Mercado Pago').setStyle(TextInputStyle.Short).setRequired(true)
                )
            );
            await interaction.showModal(modal).catch(e => { if (!isIgnorableError(e)) console.warn('⚠️ showModal:', e?.message); });
            return;
        }
        const ok = await safeDefer(interaction, true);
        if (!ok) return;
        return abrirTicket(interaction, categoriaKey);
    }
    if (interaction.isModalSubmit() && interaction.customId.startsWith('ticket_modal_')) {
        const ok = await safeDefer(interaction, true);
        if (!ok) return;
        return abrirTicket(interaction, interaction.customId.replace('ticket_modal_', ''), {
            cantidad: interaction.fields.getTextInputValue('cantidad'),
            precio:   interaction.fields.getTextInputValue('precio'),
            metodo:   interaction.fields.getTextInputValue('metodo')
        });
    }
    if (interaction.isButton() && interaction.customId.startsWith('ticket_cerrar_'))
        return cerrarTicket(interaction, parseInt(interaction.customId.replace('ticket_cerrar_', '')));
}

// ─── Stock bulk ───────────────────────────────────────────────────────────────
async function handleStockBulkModal(interaction) {
    const ok = await safeDefer(interaction, true);
    if (!ok) return;
    const texto = interaction.fields.getTextInputValue('items_texto');
    const modo  = (interaction.fields.getTextInputValue('modo_valor') || '').trim().toLowerCase();
    const modoFinal = (modo === 'r' || modo === 'reemplazar') ? 'reemplazar' : 'agregar';
    const data = loadData(interaction.guild.id);
    if (!data.stock) data.stock = [];
    const lineas = texto.split('\n').map(l => l.trim()).filter(Boolean);
    if (lineas.length === 0) return safeReply(interaction, { content: '⚠️ No se detectó ningún ítem.' });
    if (lineas.length > 50)  return safeReply(interaction, { content: '⚠️ Máximo 50 ítems por vez.' });
    if (modoFinal === 'reemplazar') data.stock = [];
    const agregados = []; const errores = [];
    for (const linea of lineas) {
        const partes = linea.split('|').map(p => p.trim());
        const nombre = partes[0];
        if (!nombre) { errores.push(`Sin nombre: \`${linea.slice(0, 30)}\``); continue; }
        const cantidad = partes[1] ? parseInt(partes[1]) : 0;
        const precio = partes[2] || null; const notas = partes[3] || null;
        const idx = data.stock.findIndex(i => i.nombre.toLowerCase() === nombre.toLowerCase());
        if (idx !== -1) {
            data.stock[idx] = { nombre, cantidad: isNaN(cantidad) ? data.stock[idx].cantidad : cantidad, precio: precio ?? data.stock[idx].precio, notas: notas ?? data.stock[idx].notas };
        } else {
            data.stock.push({ nombre, cantidad: isNaN(cantidad) ? 0 : cantidad, precio, notas });
        }
        agregados.push(nombre);
    }
    saveData(interaction.guild.id, data);
    return safeReply(interaction, { embeds: [new EmbedBuilder().setColor('#57F287')
        .setTitle(`${E.stock}  Stock ${modoFinal === 'reemplazar' ? 'reemplazado' : 'actualizado'}`)
        .setDescription(
            `${E.arrow} ${E.check} **${agregados.length}** ítem(s) cargados\n` +
            `${modoFinal === 'reemplazar' ? `${E.arrow} 🔄 Stock anterior eliminado\n` : ''}` +
            `${errores.length > 0 ? `${E.arrow} ${E.advertencia} **${errores.length}** error(es)\n` : ''}\n` +
            `**Procesados:**\n${agregados.map(n => `${E.line} \`${n}\``).join('\n')}` +
            `${errores.length > 0 ? `\n\n**Errores:**\n${errores.map(e => `${E.line} ${e}`).join('\n')}` : ''}`
        ).setFooter({ text: `Stock total: ${data.stock.length} ítem(s)` }).setTimestamp()] });
}

// ─── Sorteos ──────────────────────────────────────────────────────────────────
function sorteoEntradas(data, userId, miembro, vipRoleId) {
    const compras = data.analytics?.porCliente?.[userId]?.compras ?? 0;
    let base = Math.min(1 + Math.floor(compras / 5), 10);
    if (esClienteVip(miembro, vipRoleId)) base = Math.min(base * 2, 20);
    return base;
}

function buildSorteoEmbed(sorteo, guildName) {
    const ahora = Date.now();
    const terminado = ahora >= sorteo.fin;
    const tiempoRestante = terminado ? 'Finalizado' : tiempoRelativo(sorteo.fin - ahora);
    const participantes = sorteo.participantes?.length ?? 0;
    const entradas = sorteo.participantes?.reduce((s, p) => s + p.entradas, 0) ?? 0;
    return new EmbedBuilder()
        .setColor(terminado ? '#ED4245' : '#FEE75C')
        .setTitle(`🎉  Sorteo — ${sorteo.premio}`)
        .setDescription(
            `${E.arrow} 🎁 **Premio:**       \`${sorteo.premio}\`\n` +
            `${E.arrow} ${E.reloj} **Tiempo:**       \`${tiempoRestante}\`\n` +
            `${E.arrow} 👥 **Participantes:** \`${participantes}\`\n` +
            `${E.arrow} 🎟️ **Entradas tot.:** \`${entradas}\`\n` +
            `${E.arrow} 🏆 **Ganadores:**    \`${sorteo.cantGanadores}\`\n\n` +
            `${E.line} *Más compras = más entradas (máx. 10).*\n` +
            `${E.line} *${E.diamante} Clientes VIP tienen el doble de entradas (máx. 20).*\n` +
            `${E.line} *Host: <@${sorteo.hostId}>*\n\n` +
            (terminado && sorteo.ganadores?.length
                ? `**🏆 Ganador${sorteo.ganadores.length > 1 ? 'es' : ''}:**\n${sorteo.ganadores.map(id => `${E.arrow} <@${id}>`).join('\n')}`
                : terminado ? `${E.arrow} *Sin participantes para elegir ganador.*` : '')
        )
        .setImage(sorteo.imagen ?? BANNER_URL)
        .setFooter({ text: `${guildName} · Aurex · ID: ${sorteo.id}` })
        .setTimestamp();
}

function buildSorteoRow(sorteoId, disabled = false) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`sorteo_participar_${sorteoId}`).setLabel('🎟️ Participar').setStyle(ButtonStyle.Success).setDisabled(disabled),
        new ButtonBuilder().setCustomId(`sorteo_finalizar_${sorteoId}`).setLabel('🏁 Finalizar').setStyle(ButtonStyle.Danger).setDisabled(disabled)
    );
}

function elegirGanadores(participantes, cantidad) {
    const pool = [];
    for (const p of participantes) { for (let i = 0; i < p.entradas; i++) pool.push(p.userId); }
    if (pool.length === 0) return [];
    const unicosEnPool = new Set(pool).size;
    const ganadores = new Set();
    const maxIntentos = pool.length * 5; let intentos = 0;
    while (ganadores.size < Math.min(cantidad, unicosEnPool) && intentos < maxIntentos) {
        ganadores.add(pool[Math.floor(Math.random() * pool.length)]); intentos++;
    }
    return [...ganadores];
}

async function handleSorteoParticipar(interaction, sorteoId) {
    const data = loadData(interaction.guild.id);
    const sorteo = data.sorteos.find(s => s.id === sorteoId);
    if (!sorteo) return safeReply(interaction, { content: '⚠️ Este sorteo ya no existe.' });
    if (Date.now() >= sorteo.fin || sorteo.estado !== 'activo') return safeReply(interaction, { content: '⏰ Este sorteo ya terminó.' });
    const yaParticipa = sorteo.participantes?.find(p => p.userId === interaction.user.id);
    if (yaParticipa) return safeReply(interaction, { content: `${E.check} Ya participas con **${yaParticipa.entradas}** entrada(s). ¡Buena suerte!` });
    const entradas = sorteoEntradas(data, interaction.user.id, interaction.member, data.config?.vipRoleId ?? null);
    const esVip = esClienteVip(interaction.member, data.config?.vipRoleId ?? null);
    if (!sorteo.participantes) sorteo.participantes = [];
    sorteo.participantes.push({ userId: interaction.user.id, userTag: interaction.user.tag, entradas });
    saveData(interaction.guild.id, data);
    try {
        await interaction.message.edit({ embeds: [buildSorteoEmbed(sorteo, interaction.guild.name)], components: [buildSorteoRow(sorteoId)] }).catch(() => {});
    } catch { /* no crítico */ }
    return safeReply(interaction, {
        content: `🎟️ ¡Participas con **${entradas}** entrada(s)!${esVip ? `\n> ${E.diamante} **Bonus VIP:** Doble entradas aplicadas.` : `\n${E.line} *Más compras = más entradas (máx. 10)*`}`
    });
}

async function handleSorteoFinalizar(interaction, sorteoId) {
    const data = loadData(interaction.guild.id);
    const sorteo = data.sorteos.find(s => s.id === sorteoId);
    if (!sorteo) return safeReply(interaction, { content: '⚠️ Sorteo no encontrado.' });
    if (sorteo.estado === 'finalizado') return safeReply(interaction, { content: '⚠️ Este sorteo ya fue finalizado.' });

    const esAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
    if (interaction.user.id !== sorteo.hostId && !esAdmin)
        return safeReply(interaction, { content: `🚫 Solo el host (<@${sorteo.hostId}>) o un administrador puede finalizar este sorteo.` });

    sorteo.estado = 'finalizado'; sorteo.fin = Date.now();
    sorteo.ganadores = elegirGanadores(sorteo.participantes ?? [], sorteo.cantGanadores);
    saveData(interaction.guild.id, data);

    await safeUpdate(interaction, { embeds: [buildSorteoEmbed(sorteo, interaction.guild.name)], components: [buildSorteoRow(sorteoId, true)] });

    if (sorteo.ganadores.length > 0) {
        await interaction.channel.send({ content: `🎉 **¡Felicitaciones!** ${sorteo.ganadores.map(id => `<@${id}>`).join(', ')}\n${E.arrow} ¡Ganaste el sorteo de **${sorteo.premio}**! 🎁\n${E.line} *Si no reclamas en 24h, el host puede hacer \`$reroll ${sorteo.id}\`*` }).catch(() => {});
    } else {
        await interaction.channel.send({ content: '😔 El sorteo terminó sin participantes suficientes.' }).catch(() => {});
    }
}

async function verificarSorteos() {
    for (const guild of client.guilds.cache.values()) {
        try {
            const data = loadData(guild.id);
            if (!data.sorteos?.length) continue;
            const ahora = Date.now();
            let cambio = false;

            for (const sorteo of data.sorteos) {
                if (sorteo.estado !== 'activo' || sorteo.fin > ahora) continue;

                sorteo.estado    = 'finalizado';
                sorteo.ganadores = elegirGanadores(sorteo.participantes ?? [], sorteo.cantGanadores);
                cambio = true;

                try {
                    const canal = guild.channels.cache.get(sorteo.canalId)
                        ?? await guild.channels.fetch(sorteo.canalId).catch(() => null);
                    if (canal) {
                        if (sorteo.messageId) {
                            const msg = await canal.messages.fetch(sorteo.messageId).catch(() => null);
                            if (msg) await msg.edit({ embeds: [buildSorteoEmbed(sorteo, guild.name)], components: [buildSorteoRow(sorteo.id, true)] }).catch(() => {});
                        }
                        if (sorteo.ganadores.length > 0) {
                            await canal.send({ content: `🎉 **¡El sorteo terminó!** ${sorteo.ganadores.map(id => `<@${id}>`).join(', ')}\n${E.arrow} ¡Ganaste **${sorteo.premio}**! 🎁\n${E.line} *Si no reclamas en 24h, el host puede hacer \`$reroll ${sorteo.id}\`*` }).catch(() => {});
                        } else {
                            await canal.send({ content: '😔 El sorteo terminó sin participantes.' }).catch(() => {});
                        }
                    }
                } catch (e) { console.warn(`⚠️ verificarSorteos canal [${guild.name}]:`, e?.message); }
            }

            // Limpiar sorteos viejos (>7 días)
            const antes = data.sorteos.length;
            data.sorteos = data.sorteos.filter(s => Date.now() - (s.timestamp ?? 0) < 7 * 24 * 60 * 60 * 1000);
            if (data.sorteos.length !== antes) cambio = true;

            if (cambio) saveData(guild.id, data);
        } catch (e) { console.warn(`⚠️ verificarSorteos [${guild.name}]:`, e?.message); }
    }
}

async function handleSorteo(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator))
        return safeReply(interaction, { content: '🚫 Solo administradores.' });

    const premio        = interaction.options.getString('premio');
    const duracionMin   = interaction.options.getInteger('duracion') ?? 60;
    const cantGanadores = interaction.options.getInteger('ganadores') ?? 1;
    const imagenUrl     = interaction.options.getString('imagen') ?? null;

    // FIX #4: validar duración
    if (duracionMin < 1 || duracionMin > 10080)
        return safeReply(interaction, { content: '⚠️ La duración debe estar entre **1 minuto** y **7 días** (10080 min).' });

    if (imagenUrl) { try { new URL(imagenUrl); } catch { return safeReply(interaction, { content: '⚠️ URL de imagen no válida.' }); } }

    const data = loadData(interaction.guild.id);
    const sorteoId = `${interaction.guild.id}_${Date.now()}`;
    const fin = Date.now() + duracionMin * 60 * 1000;
    const sorteo = {
        id: sorteoId, premio, fin, cantGanadores,
        estado: 'activo', participantes: [], ganadores: [],
        canalId: interaction.channelId,
        hostId: interaction.user.id,
        hostTag: interaction.user.tag,
        timestamp: Date.now(),
        imagen: imagenUrl
    };
    data.sorteos.push(sorteo);
    saveData(interaction.guild.id, data);

    await interaction.reply({ embeds: [buildSorteoEmbed(sorteo, interaction.guild.name)], components: [buildSorteoRow(sorteoId)] });

    const msg = await interaction.fetchReply().catch(() => null);
    if (msg) {
        const dataUpd = loadData(interaction.guild.id);
        const s = dataUpd.sorteos?.find(x => x.id === sorteoId);
        if (s) { s.messageId = msg.id; saveData(interaction.guild.id, dataUpd); }
    }
}

async function handleReroll(message, sorteoId) {
    const data = loadData(message.guild.id);
    const sorteo = data.sorteos?.find(s => s.id === sorteoId);
    if (!sorteo) return message.reply('⚠️ No se encontró ese sorteo. Verifica el ID.').catch(() => {});
    if (sorteo.estado !== 'finalizado') return message.reply('⚠️ El sorteo aún no ha finalizado.').catch(() => {});

    const esAdmin = message.member?.permissions.has(PermissionFlagsBits.Administrator);
    if (message.author.id !== sorteo.hostId && !esAdmin)
        return message.reply(`🚫 Solo el host (<@${sorteo.hostId}>) o un administrador puede hacer reroll.`).catch(() => {});

    if (!sorteo.participantes?.length)
        return message.reply('😔 No hay participantes para hacer reroll.').catch(() => {});

    const nuevosGanadores = elegirGanadores(sorteo.participantes, sorteo.cantGanadores);
    sorteo.ganadores = nuevosGanadores;
    saveData(message.guild.id, data);

    const embedReroll = new EmbedBuilder().setColor('#FEE75C')
        .setTitle(`🔄  Reroll — ${sorteo.premio}`)
        .setDescription(
            `${E.arrow} 🎁 **Premio:** \`${sorteo.premio}\`\n` +
            `${E.arrow} ${E.check} **Nuevo${nuevosGanadores.length > 1 ? 's ganadores' : ' ganador'}:**\n` +
            nuevosGanadores.map(id => `${E.line} <@${id}>`).join('\n') +
            `\n\n${E.line} *Reroll realizado por <@${message.author.id}>*`
        )
        .setFooter({ text: `Aurex · ID: ${sorteoId}` })
        .setTimestamp();

    await message.channel.send({
        content: nuevosGanadores.length > 0
            ? `🔄 **¡Nuevo ganador!** ${nuevosGanadores.map(id => `<@${id}>`).join(', ')}\n${E.arrow} ¡Ganaste el sorteo de **${sorteo.premio}**! 🎁`
            : '😔 No se pudo elegir un nuevo ganador.',
        embeds: [embedReroll]
    }).catch(() => {});
}

async function handleNotificar(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator))
        return safeReply(interaction, { content: '🚫 Solo administradores.' });
    const mensaje     = interaction.options.getString('mensaje');
    const titulo      = interaction.options.getString('titulo') ?? '📢  Mensaje de la tienda';
    const soloActivos = interaction.options.getBoolean('solo_activos') ?? false;
    const imagenUrl   = interaction.options.getString('imagen') ?? null;
    const ok = await safeDefer(interaction, true);
    if (!ok) return;
    const data = loadData(interaction.guild.id);
    let clienteIds = Object.keys(data.analytics?.porCliente ?? {});
    if (soloActivos) {
        const hace30 = Date.now() - 30 * 24 * 60 * 60 * 1000;
        const clientesActivos = new Set(data.ventas.filter(v => v.estado !== 'cancelada' && v.timestamp >= hace30).map(v => v.clienteId));
        clienteIds = clienteIds.filter(id => clientesActivos.has(id));
    }
    if (clienteIds.length === 0) return interaction.editReply({ content: '📭 No hay clientes registrados para notificar.' });
    const embedNotif = new EmbedBuilder().setColor('#5865F2')
        .setAuthor({ name: interaction.guild.name, iconURL: interaction.guild.iconURL({ dynamic: true }) ?? undefined })
        .setTitle(titulo).setThumbnail(interaction.guild.iconURL({ dynamic: true }) ?? null)
        .setDescription(`${mensaje}\n\n━━━━━━━━━━━━━━━━━━━━━━━━\n*Este es un mensaje oficial de **${interaction.guild.name}**.*`)
        .setFooter({ text: `${interaction.guild.name} · powered by Aurex` }).setTimestamp();
    if (imagenUrl) { try { new URL(imagenUrl); embedNotif.setImage(imagenUrl); } catch {} }

    // FIX #9: Rate limit seguro con timeout de 5s por DM
    let enviados = 0, fallidos = 0;
    for (let i = 0; i < clienteIds.length; i += 2) {
        await Promise.all(clienteIds.slice(i, i + 2).map(async (id) => {
            try {
                const miembro = interaction.guild.members.cache.get(id)
                    ?? await interaction.guild.members.fetch(id).catch(() => null);
                if (!miembro) { fallidos++; return; }
                const enviado = await withTimeout(enviarDM(miembro.user, embedNotif), 5000).catch(() => false);
                enviado ? enviados++ : fallidos++;
            } catch { fallidos++; }
        }));
        if (i + 2 < clienteIds.length) await new Promise(r => setTimeout(r, 2000));
    }
    return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#57F287').setTitle(`${E.bot}  Notificación enviada`)
        .setDescription(
            `${E.arrow} ${E.check} **Enviados:**  \`${enviados}\`\n` +
            `${E.arrow} ${E.cruz} **Fallidos:**  \`${fallidos}\`\n` +
            `${E.arrow} 👥 **Total:**     \`${clienteIds.length}\`\n\n` +
            `${E.line} *Filtro activos: \`${soloActivos ? 'Sí (últimos 30 días)' : 'No'}\`*`
        ).setTimestamp()] });
}

async function handleFactura(interaction) {
    const ordenId = interaction.options.getInteger('orden');
    const data = loadData(interaction.guild.id);
    const venta = data.ventas.find(v => v.id === ordenId);
    if (!venta) return safeReply(interaction, { content: `⚠️ No existe la orden \`#${ordenId}\`.` });
    if (venta.estado === 'cancelada') return safeReply(interaction, { content: `⚠️ La orden \`#${ordenId}\` fue cancelada.` });
    const esAdmin = interaction.member.permissions.has(PermissionFlagsBits.ManageMessages);
    if (interaction.user.id !== venta.clienteId && !esAdmin)
        return safeReply(interaction, { content: '🚫 Solo el cliente o un administrador puede solicitar la factura.' });
    const resena = data.resenas?.find(r => r.ordenId === ordenId);
    const tierCliente = getTier(data.analytics?.porCliente?.[venta.clienteId]?.compras ?? 0);
    const totalCompras = data.analytics?.porCliente?.[venta.clienteId]?.compras ?? 0;
    const embedFactura = new EmbedBuilder().setColor('#57F287')
        .setAuthor({ name: interaction.guild.name, iconURL: interaction.guild.iconURL({ dynamic: true }) ?? undefined })
        .setTitle(`${E.invoice}  Factura — Orden \`#${ordenId}\``)
        .setThumbnail(interaction.guild.iconURL({ dynamic: true }) ?? null)
        .setDescription(
            `**📋 Detalles del pedido**\n` +
            `${E.arrow} ${E.orders} **Orden #:**   \`${venta.id}\`\n` +
            `${E.arrow} ${E.caja} **Producto:**  \`${venta.producto}\`\n` +
            `${E.arrow} ${E.money} **Cantidad:**  \`${formatRobux(venta.robux)}\`\n` +
            `${E.arrow} 💵 **Precio:**    \`${venta.precio ?? 'No especificado'}\`\n` +
            `${E.arrow} ${E.tarjeta} **Método:**    \`${venta.metodo}\`\n` +
            `${E.arrow} 📅 **Fecha:**     \`${new Date(venta.timestamp).toLocaleString('es-MX')}\`\n\n` +
            `**👤 Cliente**\n` +
            `${E.arrow} 🏷️ <@${venta.clienteId}>\n` +
            `${E.arrow} ${E.carrito} **Compras:** \`${totalCompras}\`\n` +
            `${E.arrow} 🎖️ **Tier:** \`${tierCliente ? `${tierCliente.emoji} ${tierCliente.label}` : 'Sin tier'}\`\n\n` +
            `**🤝 Operador**\n${E.arrow} <@${venta.vendedorId}> — \`${venta.vendedorTag}\`\n\n` +
            (resena ? `**${E.review} Reseña**\n${E.arrow} ${estrellas(resena.estrellas)} \`${resena.estrellas}/5\`${resena.comentario ? ` — *"${resena.comentario}"*` : ''}${resena.imagen ? `\n${E.line} 📸 [Ver prueba](${resena.imagen})` : ''}\n\n` : '') +
            `━━━━━━━━━━━━━━━━━━━━━━━━\n*Guarda este comprobante para consultas futuras.*`
        ).setImage(BANNER_URL).setFooter({ text: `${interaction.guild.name} · powered by Aurex · ${today()}` }).setTimestamp(venta.timestamp);
    const clienteUser = await interaction.client.users.fetch(venta.clienteId).catch(() => null);
    if (!clienteUser) return safeReply(interaction, { content: '⚠️ No se encontró al usuario cliente.' });
    const sent = await enviarDM(clienteUser, embedFactura);
    return safeReply(interaction, { content: sent ? `${E.check} Factura enviada por DM a <@${venta.clienteId}>.` : `⚠️ No se pudo enviar el DM a <@${venta.clienteId}>. Tiene los DMs desactivados.` });
}

async function handleServidorStats(interaction) {
    const ok = await safeDefer(interaction);
    if (!ok) return;
    const data  = loadData(interaction.guild.id);
    const tdata = loadTickets(interaction.guild.id);
    const ventasActivas = data.ventas.filter(v => v.estado !== 'cancelada');
    const topV = Object.entries(data.analytics.porVendedor ?? {}).sort((a, b) => b[1].ventas - a[1].ventas)[0];
    const topC = Object.entries(data.analytics.porCliente  ?? {}).sort((a, b) => b[1].compras - a[1].compras)[0];
    const hoy    = ventasPorRango(ventasActivas, 'hoy');
    const semana = ventasPorRango(ventasActivas, 'semana');
    const mes    = ventasPorRango(ventasActivas, 'mes');
    const totalResenas = data.resenas?.length ?? 0;
    const promedioResenas = totalResenas > 0 ? (data.resenas.reduce((s, r) => s + r.estrellas, 0) / totalResenas).toFixed(1) : null;
    const tierConteo = { bronce: 0, plata: 0, oro: 0, vip: 0 };
    for (const [, c] of Object.entries(data.analytics.porCliente ?? {})) {
        const t = getTier(c.compras ?? 0); if (t) tierConteo[t.nombre]++;
    }
    return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#5865F2')
        .setAuthor({ name: interaction.guild.name, iconURL: interaction.guild.iconURL({ dynamic: true }) ?? undefined })
        .setTitle(`${E.analytics}  Estadísticas del Servidor`)
        .setThumbnail(interaction.guild.iconURL({ dynamic: true }) ?? null)
        .setDescription(
            `**${E.orders} Pedidos**\n` +
            `${E.arrow} 🌅 **Hoy:**         \`${hoy.length}\` — \`${formatRobux(hoy.reduce((s, v) => s + v.robux, 0))}\`\n` +
            `${E.arrow} 📅 **Esta semana:** \`${semana.length}\` — \`${formatRobux(semana.reduce((s, v) => s + v.robux, 0))}\`\n` +
            `${E.arrow} 🗓️ **Este mes:**    \`${mes.length}\` — \`${formatRobux(mes.reduce((s, v) => s + v.robux, 0))}\`\n` +
            `${E.arrow} 📊 **Histórico:**   \`${ventasActivas.length}\` — \`${formatRobux(data.analytics.totalRobux)}\`\n\n` +
            `**👥 Comunidad**\n` +
            `${E.arrow} 🧑‍💼 **Clientes únicos:**   \`${new Set(ventasActivas.map(v => v.clienteId)).size}\`\n` +
            `${E.arrow} 🤝 **Operadores activos:** \`${new Set(ventasActivas.map(v => v.vendedorId)).size}\`\n` +
            `${E.arrow} ${E.ticket} **Tickets cerrados:**  \`${tdata.tickets.filter(t => t.estado === 'cerrado').length}\`\n` +
            `${E.arrow} 📂 **Tickets abiertos:**  \`${tdata.tickets.filter(t => t.estado === 'abierto').length}\`\n` +
            (promedioResenas ? `${E.arrow} ${E.review} **Valoración:** \`${promedioResenas}/5\` *(${totalResenas} reseñas)*\n` : '') +
            `\n**🎖️ Distribución de Tiers**\n` +
            `${E.line} 🥉 Bronce: \`${tierConteo.bronce}\`  🥈 Plata: \`${tierConteo.plata}\`  🥇 Oro: \`${tierConteo.oro}\`  ${E.diamante} VIP: \`${tierConteo.vip}\`\n\n` +
            `**🏆 Destacados**\n` +
            `${E.arrow} ${E.corona} **Top operador:** ${topV ? `<@${topV[0]}> (\`${topV[1].ventas}\` pedidos)` : '`Sin datos`'}\n` +
            `${E.arrow} ${E.carrito} **Top cliente:**  ${topC ? `<@${topC[0]}> (\`${topC[1].compras}\` compras)` : '`Sin datos`'}`
        ).setImage(BANNER_URL).setFooter({ text: `Aurex · ${today()}` }).setTimestamp()] });
}

// ─── Recordatorios de tickets ─────────────────────────────────────────────────
async function verificarRecordatorios() {
    const LIMITE_MS = 60 * 60 * 1000;
    const ahora = Date.now();
    await Promise.allSettled([...client.guilds.cache.values()].map(async guild => {
        try {
            const tdata = loadTickets(guild.id);
            if (!tdata.config.staffRoleId) return;
            const ticketsAbiertos = tdata.tickets.filter(t => t.estado === 'abierto');
            let guardado = false;
            for (const ticket of ticketsAbiertos) {
                const ultimaActividad = ticket.ultimaActividad ?? ticket.timestamp;
                if (ahora - ultimaActividad >= LIMITE_MS && !ticket.recordatorioEnviado) {
                    try {
                        const canal = guild.channels.cache.get(ticket.channelId)
                            ?? await guild.channels.fetch(ticket.channelId).catch(() => null);
                        if (!canal) continue;
                        const cat = CATEGORIAS[ticket.categoria] ?? { emoji: '🎫', label: 'Ticket' };
                        await canal.send({
                            content: `<@&${tdata.config.staffRoleId}>`,
                            embeds: [new EmbedBuilder().setColor('#ED4245').setTitle(`${E.reloj}  Ticket sin respuesta`)
                                .setDescription(
                                    `${E.arrow} ${cat.emoji} **Ticket #${ticket.id}** (${cat.label})\n` +
                                    `${E.arrow} 👤 **Usuario:** <@${ticket.userId}>\n` +
                                    `${E.arrow} ⏱️ **Sin respuesta:** \`${tiempoRelativo(ahora - ultimaActividad)}\``
                                ).setTimestamp()]
                        }).catch(() => {});
                        ticket.recordatorioEnviado = true; guardado = true;
                    } catch (err) { console.warn(`⚠️ Recordatorio ticket #${ticket.id}:`, err?.message); }
                }
            }
            if (guardado) saveTickets(guild.id, tdata);
        } catch (err) { console.warn(`⚠️ [recordatorio] ${guild.name}:`, err?.message); }
    }));
}

async function limpiarAfkExpirados() {
    for (const guild of client.guilds.cache.values()) {
        try {
            const data = loadData(guild.id);
            const ahora = Date.now();
            let cambio = false;
            for (const [uid] of Object.entries(data.afk ?? {})) {
                if (ahora - data.afk[uid].tiempo > AFK_TIMEOUT_MS) { delete data.afk[uid]; cambio = true; }
            }
            if (cambio) saveData(guild.id, data);
        } catch { /* no crítico */ }
    }
}

function actualizarActividadTicket(guildId, channelId) {
    try {
        const tdata = loadTickets(guildId);
        const ticket = tdata.tickets.find(t => t.channelId === channelId && t.estado === 'abierto');
        if (!ticket) return;
        ticket.ultimaActividad = Date.now();
        ticket.recordatorioEnviado = false;
        saveTickets(guildId, tdata);
    } catch { /* no crítico */ }
}

// ─── Cliente Discord ──────────────────────────────────────────────────────────
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

client.on('error', (err) => { if (!isIgnorableError(err)) console.error('❌ [Client]', err?.message); });
client.on('warn',  (msg) => console.warn('⚠️ [Client warn]', msg));

client.on('shardDisconnect', (event, id) => {
    console.warn(`⚠️ Shard ${id} desconectado (code: ${event.code}). Intentando reconectar...`);
});
client.on('shardReconnecting', (id) => {
    console.log(`🔄 Shard ${id} reconectando...`);
});
client.on('shardResume', (id, replayed) => {
    console.log(`✅ Shard ${id} reconectado. Eventos replayados: ${replayed}`);
});

client.once('clientReady', () => {
    console.log(`✅ Bot listo como ${client.user.tag}`);
    console.log(`📁 Directorio de datos: ${DATA_DIR}`);
    client.user.setActivity('Aurex • /help 💎', { type: 3 });

    setInterval(() => {
        console.log(`💓 Keep-alive • ${new Date().toLocaleString('es-MX')} • ${client.ws.ping}ms • Guilds: ${client.guilds.cache.size}`);
    }, 5 * 60 * 1000);

    setInterval(async () => {
        await verificarRecordatorios().catch(e => console.warn('⚠️ verificarRecordatorios:', e?.message));
        await verificarSorteos().catch(e => console.warn('⚠️ verificarSorteos:', e?.message));
    }, 5 * 60 * 1000);

    setInterval(limpiarAfkExpirados, 60 * 60 * 1000);

    verificarSorteos().catch(e => console.warn('⚠️ verificarSorteos inicial:', e?.message));
});

// ─── Sistema AFK ──────────────────────────────────────────────────────────────
const AFK_TIMEOUT_MS = 24 * 60 * 60 * 1000;

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;
    actualizarActividadTicket(message.guild.id, message.channel.id);

    // ── Prefijo de texto ──────────────────────────────────────────────────
    if (message.content.startsWith(PREFIX)) {
        // FIX #5 (texto): cooldown básico para comandos de prefijo
        const espera = checkCooldown(message.guild.id, message.author.id, 'prefix', 3);
        if (espera > 0) return;

        const args = message.content.slice(PREFIX.length).trim().split(/ +/);
        const cmd  = args.shift().toLowerCase();

        if (cmd === 'ping') {
            return message.reply(`🏓 Pong! \`${Math.round(client.ws.ping)}ms\``).catch(() => {});
        }
        if (cmd === 'help') {
            return message.reply({ embeds: [buildHelpInicio(message.guild)], components: buildHelpRows() }).catch(() => {});
        }
        if (cmd === 'reroll') {
            const sorteoId = args[0];
            if (!sorteoId) return message.reply(`⚠️ Uso: \`${PREFIX}reroll <id_del_sorteo>\``).catch(() => {});
            return handleReroll(message, sorteoId);
        }
        return;
    }

    // ── Sistema AFK ───────────────────────────────────────────────────────
    try {
        const data = loadData(message.guild.id);
        const ahora = Date.now();

        let limpiado = false;
        for (const [uid, afkInfo] of Object.entries(data.afk ?? {})) {
            if (ahora - afkInfo.tiempo > AFK_TIMEOUT_MS) { delete data.afk[uid]; limpiado = true; }
        }
        if (limpiado) saveData(message.guild.id, data);

        // Volver del AFK
        if (data.afk[message.author.id]) {
            const afkInfo = data.afk[message.author.id];
            const duracion = tiempoRelativo(ahora - afkInfo.tiempo);
            const menciones = afkInfo.menciones ?? [];
            delete data.afk[message.author.id];
            saveData(message.guild.id, data);

            try {
                const miembro = message.guild.members.cache.get(message.author.id);
                if (miembro?.nickname?.startsWith('[AFK] ')) {
                    const nickSinAfk = miembro.nickname.replace('[AFK] ', '');
                    await miembro.setNickname(nickSinAfk === message.author.username ? null : nickSinAfk).catch(() => {});
                }
            } catch { /* sin permisos */ }

            let desc = `### 👋  ¡Bienvenido de vuelta, ${message.author.username}!\n\n` +
                `${E.arrow} ${E.reloj} Estuviste ausente **${duracion}**\n` +
                `${E.arrow} 📝 Motivo: *${afkInfo.motivo}*\n`;

            if (menciones.length > 0) {
                desc += `\n**${E.campana} Te mencionaron ${menciones.length} vez${menciones.length > 1 ? 'es' : ''}:**\n`;
                for (const m of menciones.slice(-10)) {
                    desc += `${E.line} **[${m.tag}](${m.url})** en <#${m.channelId}> — <t:${Math.floor(m.timestamp / 1000)}:R>\n`;
                    if (m.contenido) desc += `  └ *"${m.contenido.slice(0, 80)}${m.contenido.length > 80 ? '...' : ''}"*\n`;
                }
                if (menciones.length > 10) desc += `${E.line} *...y ${menciones.length - 10} más.*\n`;
            } else {
                desc += `\n${E.line} *Nadie te mencionó mientras estabas ausente.*`;
            }

            await message.reply({
                embeds: [new EmbedBuilder()
                    .setColor('#57F287')
                    .setDescription(desc)
                    .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
                    .setFooter({ text: 'Aurex • AFK finalizado' })
                    .setTimestamp()]
            }).catch(() => {});
            return;
        }

        // Registrar mención a usuarios AFK
        if (message.mentions.users.size > 0) {
            let modificado = false;
            for (const [, usuario] of message.mentions.users) {
                if (!data.afk[usuario.id] || message.author.id === usuario.id) continue;
                const afkInfo = data.afk[usuario.id];
                if (!afkInfo.menciones) afkInfo.menciones = [];
                afkInfo.menciones.push({
                    tag:       message.author.tag,
                    userId:    message.author.id,
                    url:       message.url,
                    channelId: message.channel.id,
                    timestamp: ahora,
                    contenido: message.content.replace(/<@!?\d+>/g, '').trim() || null
                });
                modificado = true;
                const durAFK = tiempoRelativo(ahora - afkInfo.tiempo);
                await message.reply({
                    embeds: [new EmbedBuilder()
                        .setColor('#ED4245')
                        .setDescription(
                            `${E.arrow} 💤 **${usuario.username}** está en modo AFK hace **${durAFK}**\n` +
                            `${E.line} *Motivo: ${afkInfo.motivo}*\n\n` +
                            `${E.campana} Tu mención fue registrada y le avisaremos al volver.`
                        )
                        .setFooter({ text: 'Aurex • AFK' })
                        .setTimestamp()]
                }).catch(() => {});
            }
            if (modificado) saveData(message.guild.id, data);
        }

        // Mención al bot
        if (message.mentions.has(client.user)) {
            await message.reply({
                embeds: [new EmbedBuilder()
                    .setColor('#5865F2')
                    .setDescription(`### ${E.bot}  ¡Hola!\n\n${E.arrow} Usa \`/help\` para ver todos mis comandos.\n${E.arrow} Prefijo de texto: \`${PREFIX}\``)]
            }).catch(() => {});
        }
    } catch (e) { if (!isIgnorableError(e)) console.warn('⚠️ messageCreate:', e?.message); }
});

// ─── Interactions ─────────────────────────────────────────────────────────────
client.on('interactionCreate', async (interaction) => {
    try {
        if (!interaction.guild) return;

        // ── Tickets ───────────────────────────────────────────────────────
        if (
            (interaction.isStringSelectMenu() && interaction.customId === 'ticket_categoria') ||
            (interaction.isModalSubmit()      && interaction.customId.startsWith('ticket_modal_')) ||
            (interaction.isButton()           && interaction.customId.startsWith('ticket_cerrar_'))
        ) return safeHandle(interaction, () => handleTicketInteraction(interaction));

        // ── Stock bulk ────────────────────────────────────────────────────
        if (interaction.isModalSubmit() && interaction.customId === 'stock_bulk_modal')
            return safeHandle(interaction, () => handleStockBulkModal(interaction));

        // ── Sorteos ───────────────────────────────────────────────────────
        if (interaction.isButton() && interaction.customId.startsWith('sorteo_participar_'))
            return safeHandle(interaction, () => handleSorteoParticipar(interaction, interaction.customId.replace('sorteo_participar_', '')));
        if (interaction.isButton() && interaction.customId.startsWith('sorteo_finalizar_'))
            return safeHandle(interaction, () => handleSorteoFinalizar(interaction, interaction.customId.replace('sorteo_finalizar_', '')));

        // ── Help ──────────────────────────────────────────────────────────
        if (interaction.isButton() && interaction.customId.startsWith('help_')) {
            return safeHandle(interaction, async () => {
                const key = interaction.customId.replace('help_cat_', '').replace('help_', '');
                if (key === 'inicio') return interaction.update({ embeds: [buildHelpInicio(interaction.guild)], components: buildHelpRows() });
                const cat = HELP_CATEGORIAS[key];
                if (!cat) return;
                return interaction.update({ embeds: [cat.embed()], components: buildHelpRows() });
            });
        }

        // ── Cancelar orden ────────────────────────────────────────────────
        if (interaction.isButton() && interaction.customId.startsWith('cancelar_confirm_')) {
            return safeHandle(interaction, async () => {
                const ordenId = parseInt(interaction.customId.split('_')[2]);
                const data = loadData(interaction.guild.id);
                const venta = data.ventas.find(v => v.id === ordenId);
                if (!venta || venta.estado === 'cancelada')
                    return interaction.update({ content: '⚠️ Esta orden ya fue procesada.', embeds: [], components: [] });

                venta.estado = 'cancelada';

                // FIX #7: eliminar reseña asociada al cancelar
                if (data.resenas) {
                    data.resenas = data.resenas.filter(r => r.ordenId !== ordenId);
                }

                data.analytics.totalVentas = Math.max(0, data.analytics.totalVentas - 1);
                data.analytics.totalRobux  = Math.max(0, data.analytics.totalRobux - venta.robux);
                if (data.analytics.porVendedor[venta.vendedorId]) {
                    data.analytics.porVendedor[venta.vendedorId].ventas = Math.max(0, (data.analytics.porVendedor[venta.vendedorId].ventas ?? 1) - 1);
                    data.analytics.porVendedor[venta.vendedorId].robux  = Math.max(0, (data.analytics.porVendedor[venta.vendedorId].robux  ?? 0) - venta.robux);
                }
                if (data.analytics.porCliente?.[venta.clienteId]) {
                    data.analytics.porCliente[venta.clienteId].compras = Math.max(0, (data.analytics.porCliente[venta.clienteId].compras ?? 1) - 1);
                    data.analytics.porCliente[venta.clienteId].robux   = Math.max(0, (data.analytics.porCliente[venta.clienteId].robux   ?? 0) - venta.robux);
                }
                saveData(interaction.guild.id, data);

                // FIX #8: recalcular tier al bajar compras
                await actualizarTier(
                    interaction.guild,
                    venta.clienteId,
                    data.analytics.porCliente?.[venta.clienteId]?.compras ?? 0,
                    data.config.tierRoles
                );

                return interaction.update({ embeds: [new EmbedBuilder().setColor('#ED4245').setTitle('❌  Orden cancelada')
                    .setDescription(
                        `${E.arrow} ${E.orders} **Orden:** \`#${ordenId}\`\n` +
                        `${E.arrow} ${E.caja} **Producto:** \`${venta.producto}\`\n` +
                        `${E.arrow} 👤 **Cliente:** <@${venta.clienteId}>\n` +
                        `${E.arrow} 🔨 **Por:** <@${interaction.user.id}>`
                    ).setTimestamp()], components: [] });
            });
        }
        if (interaction.isButton() && interaction.customId.startsWith('cancelar_abort_'))
            return interaction.update({ content: '✅ Cancelación abortada.', embeds: [], components: [] }).catch(() => {});

        // ── Reseña (botón) ────────────────────────────────────────────────
        if (interaction.isButton() && interaction.customId.startsWith('reseña_')) {
            return safeHandle(interaction, async () => {
                const ordenId = parseInt(interaction.customId.split('_')[1]);
                const data = loadData(interaction.guild.id);
                const venta = data.ventas.find(v => v.id === ordenId);
                if (!venta || interaction.user.id !== venta.clienteId)
                    return safeReply(interaction, { content: '⚠️ Solo el cliente puede dejar reseña.' });
                if (data.resenas.find(r => r.ordenId === ordenId))
                    return safeReply(interaction, { content: '⚠️ Ya dejaste una reseña para esta orden.' });
                return mostrarModalResena(interaction, ordenId);
            });
        }

        // ── Reseña (modal submit) ─────────────────────────────────────────
        if (interaction.isModalSubmit() && interaction.customId.startsWith('modal_resena_')) {
            return safeHandle(interaction, async () => {
                const ordenId      = parseInt(interaction.customId.split('_')[2]);
                const data         = loadData(interaction.guild.id);
                const venta        = data.ventas.find(v => v.id === ordenId);
                if (!venta) return safeReply(interaction, { content: '⚠️ Orden no encontrada.' });
                const numEstrellas = parseInt(interaction.fields.getTextInputValue('estrellas'));
                const comentario   = interaction.fields.getTextInputValue('comentario') || null;
                const imagenUrl    = interaction.fields.getTextInputValue('imagen_url') || null;
                if (isNaN(numEstrellas) || numEstrellas < 1 || numEstrellas > 5)
                    return safeReply(interaction, { content: '⚠️ Calificación del 1 al 5.' });
                let imagenValida = null;
                if (imagenUrl) { try { new URL(imagenUrl); imagenValida = imagenUrl; } catch { /* ignorar */ } }
                if (!data.resenas) data.resenas = [];
                data.resenas.push({ ordenId, clienteId: venta.clienteId, clienteTag: venta.clienteTag, vendedorId: venta.vendedorId, estrellas: numEstrellas, comentario, imagen: imagenValida, timestamp: Date.now() });
                saveData(interaction.guild.id, data);
                const embedResena = new EmbedBuilder().setColor('#FEE75C')
                    .setTitle(`${E.review}  Reseña — Orden \`#${ordenId}\``)
                    .setDescription(
                        `${E.arrow} 👤 **Cliente:**  <@${venta.clienteId}>\n` +
                        `${E.arrow} 🤝 **Operador:** <@${venta.vendedorId}>\n` +
                        `${E.arrow} ${estrellas(numEstrellas)} \`${numEstrellas}/5\`\n` +
                        (comentario ? `\n${E.line} *"${comentario}"*\n` : '') +
                        (imagenValida ? `\n${E.line} 📸 *Imagen adjunta como prueba*` : '')
                    ).setTimestamp();
                if (imagenValida) embedResena.setImage(imagenValida);
                await safeReply(interaction, { content: '✅ ¡Gracias por tu reseña!', embeds: [embedResena] });
                if (data.config.resenaChannelId) {
                    const canal = interaction.guild.channels.cache.get(data.config.resenaChannelId);
                    if (canal) await canal.send({ embeds: [embedResena] }).catch(() => {});
                }
            });
        }

        if (!interaction.isChatInputCommand()) return;

        // ─── Slash commands ───────────────────────────────────────────────
        safeHandle(interaction, async () => {
            const data  = loadData(interaction.guild.id);
            const guild = interaction.guild;
            const user  = interaction.user;

            if (interaction.commandName === 'help')
                return interaction.reply({ embeds: [buildHelpInicio(guild)], components: buildHelpRows(), flags: 64 });

            if (interaction.commandName === 'ping')
                return safeReply(interaction, { content: `🏓 Pong! \`${Math.round(client.ws.ping)}ms\`` });

            if (interaction.commandName === 'ticket-setup')   return handleTicketSetup(interaction);
            if (interaction.commandName === 'sorteo')         return handleSorteo(interaction);
            if (interaction.commandName === 'notificar')      return handleNotificar(interaction);
            if (interaction.commandName === 'factura')        return handleFactura(interaction);
            if (interaction.commandName === 'servidor-stats') return handleServidorStats(interaction);

            if (interaction.commandName === 'setvip') {
                if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator))
                    return safeReply(interaction, { content: '🚫 Solo administradores.' });
                const rol = interaction.options.getRole('rol');
                data.config.vipRoleId = rol.id; saveData(guild.id, data);
                return safeReply(interaction, { embeds: [new EmbedBuilder().setColor('#FEE75C')
                    .setTitle(`${E.roles}  Rol VIP configurado`)
                    .setDescription(`${E.arrow} ${E.diamante} **Rol VIP:** <@&${rol.id}>\n${E.arrow} 🎟️ Los miembros con este rol tendrán **doble entrada** en sorteos.`)
                    .setTimestamp()] });
            }

            if (interaction.commandName === 'settiers') {
                if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator))
                    return safeReply(interaction, { content: '🚫 Solo administradores.' });
                const rolBronce = interaction.options.getRole('bronce');
                const rolPlata  = interaction.options.getRole('plata');
                const rolOro    = interaction.options.getRole('oro');
                const rolVip    = interaction.options.getRole('vip');
                if (!data.config.tierRoles) data.config.tierRoles = {};
                if (rolBronce) data.config.tierRoles.bronce = rolBronce.id;
                if (rolPlata)  data.config.tierRoles.plata  = rolPlata.id;
                if (rolOro)    data.config.tierRoles.oro    = rolOro.id;
                if (rolVip)    data.config.tierRoles.vip    = rolVip.id;
                const sinCambios = !rolBronce && !rolPlata && !rolOro && !rolVip;
                if (!sinCambios) saveData(guild.id, data);
                const tr = data.config.tierRoles;
                return safeReply(interaction, { embeds: [new EmbedBuilder().setColor('#FEE75C').setTitle(`${E.roles}  Tiers de compras`)
                    .setDescription(
                        `${sinCambios ? `${E.line} *Mostrando configuración actual.*\n\n` : ''}` +
                        `${E.arrow} 🥉 **Bronce** *(1+)*   → ${tr.bronce ? `<@&${tr.bronce}>` : '`Sin configurar`'}\n` +
                        `${E.arrow} 🥈 **Plata**  *(5+)*   → ${tr.plata  ? `<@&${tr.plata}>`  : '`Sin configurar`'}\n` +
                        `${E.arrow} 🥇 **Oro**    *(10+)*  → ${tr.oro    ? `<@&${tr.oro}>`    : '`Sin configurar`'}\n` +
                        `${E.arrow} ${E.diamante} **VIP**    *(20+)*  → ${tr.vip    ? `<@&${tr.vip}>`    : '`Sin configurar`'}`
                    ).setFooter({ text: sinCambios ? 'Sin cambios' : '✅ Guardado' }).setTimestamp()] });
            }

            if (interaction.commandName === 'vender') {
                const espera = checkCooldown(guild.id, user.id, 'vender', 10);
                if (espera > 0) return safeReply(interaction, { content: `${E.relojArena} Espera **${espera}s**.` });
                const producto = interaction.options.getString('producto');
                const clienteU = interaction.options.getUser('cliente');
                const vendedor = interaction.options.getUser('vendedor');
                const cantidad = interaction.options.getString('cantidad');
                const precio   = interaction.options.getString('precio');
                const metodo   = interaction.options.getString('metodo') ?? 'No especificado';
                const robux    = parseRobux(cantidad);
                if (!robux) return safeReply(interaction, { content: '⚠️ Cantidad inválida. Usa: `1000`, `1k`, `2.5k`.' });
                const n = nextVentaId(data.ventas);
                const venta = { id: n, producto, clienteId: clienteU.id, clienteTag: clienteU.tag, vendedorId: vendedor.id, vendedorTag: vendedor.tag, robux, precio: precio ?? 'No especificado', metodo, timestamp: Date.now(), estado: 'completada' };
                data.ventas.push(venta);
                data.analytics.totalVentas++;
                data.analytics.totalRobux += robux;
                if (!data.analytics.porVendedor[vendedor.id]) data.analytics.porVendedor[vendedor.id] = { ventas: 0, robux: 0, tag: vendedor.tag };
                data.analytics.porVendedor[vendedor.id].ventas++;
                data.analytics.porVendedor[vendedor.id].robux += robux;
                data.analytics.porVendedor[vendedor.id].tag = vendedor.tag;
                if (!data.analytics.porCliente[clienteU.id]) data.analytics.porCliente[clienteU.id] = { compras: 0, robux: 0, tag: clienteU.tag };
                data.analytics.porCliente[clienteU.id].compras++;
                data.analytics.porCliente[clienteU.id].robux += robux;
                data.analytics.porCliente[clienteU.id].tag = clienteU.tag;
                saveData(guild.id, data);
                await actualizarTier(guild, clienteU.id, data.analytics.porCliente[clienteU.id].compras, data.config.tierRoles);
                const rowResena = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`reseña_${n}`).setLabel('⭐ Dejar reseña').setStyle(ButtonStyle.Secondary)
                );
                await safeReplyPublic(interaction, { embeds: [buildVentaPublicaEmbed(venta, n)], components: [rowResena] });
                if (data.config.dmEnabled) await enviarDM(clienteU, buildDMVentaEmbed(venta, n, guild.name, guild.iconURL({ dynamic: true })));
                if (data.config.logChannelId) {
                    const lc = guild.channels.cache.get(data.config.logChannelId);
                    if (lc) await lc.send({ embeds: [buildLogEmbed(venta, n)] }).catch(() => {});
                }
                if (data.analytics.totalVentas % 10 === 0) {
                    await interaction.followUp({ embeds: [new EmbedBuilder().setColor('#FEE75C')
                        .setTitle('🏆  ¡Hito alcanzado!')
                        .setDescription(`${E.arrow} **${guild.name}** alcanzó **${data.analytics.totalVentas}** pedidos.\n${E.arrow} ${E.money} Total: \`${formatRobux(data.analytics.totalRobux)}\``)
                        .setTimestamp()] }).catch(() => {});
                }
                return;
            }

            if (interaction.commandName === 'orden') {
                const venta = data.ventas.find(v => v.id === interaction.options.getInteger('id'));
                if (!venta) return safeReply(interaction, { content: '⚠️ No existe esa orden.' });
                const resena = data.resenas?.find(r => r.ordenId === venta.id);
                const embedOrden = new EmbedBuilder().setColor(venta.estado === 'cancelada' ? '#ED4245' : '#5865F2')
                    .setTitle(`${venta.estado === 'cancelada' ? E.cruz : E.check}  Orden \`#${venta.id}\``)
                    .setDescription(
                        `${E.arrow} ${E.caja} **Producto:** \`${venta.producto}\`\n` +
                        `${E.arrow} ${E.money} **Cantidad:** \`${formatRobux(venta.robux)}\`\n` +
                        `${E.arrow} 💵 **Precio:**   \`${venta.precio}\`\n` +
                        `${E.arrow} ${E.tarjeta} **Método:**   \`${venta.metodo}\`\n` +
                        `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                        `${E.arrow} 👤 **Cliente:**  <@${venta.clienteId}>\n` +
                        `${E.arrow} 🤝 **Operador:** <@${venta.vendedorId}>\n\n` +
                        `**${E.review} Reseña:** ${resena
                            ? `${estrellas(resena.estrellas)} \`${resena.estrellas}/5\`` +
                              (resena.comentario ? ` — *"${resena.comentario}"*` : '') +
                              (resena.imagen ? `\n${E.line} 📸 [Ver prueba](${resena.imagen})` : '')
                            : '*Sin reseña aún*'}`
                    ).setFooter({ text: `Estado: ${venta.estado}` }).setTimestamp(venta.timestamp);
                if (resena?.imagen) embedOrden.setImage(resena.imagen);
                return safeReply(interaction, { embeds: [embedOrden] });
            }

            if (interaction.commandName === 'buscar') {
                const objetivo = interaction.options.getUser('cliente');
                const ventas = data.ventas.filter(v => v.clienteId === objetivo.id && v.estado !== 'cancelada');
                if (ventas.length === 0) return safeReply(interaction, { content: `📭 **${objetivo.username}** no tiene pedidos.` });
                const ultimas = ventas.slice(-8).reverse();
                const resenasCli = data.resenas?.filter(r => r.clienteId === objetivo.id) ?? [];
                const promedio = resenasCli.length > 0 ? (resenasCli.reduce((s, r) => s + r.estrellas, 0) / resenasCli.length).toFixed(1) : null;
                const tierCliente = getTier(data.analytics.porCliente?.[objetivo.id]?.compras ?? 0);
                return safeReply(interaction, { embeds: [new EmbedBuilder().setColor('#5865F2').setTitle(`👤  Historial de ${objetivo.username}`).setThumbnail(objetivo.displayAvatarURL({ dynamic: true }))
                    .setDescription(
                        `${E.arrow} ${E.carrito} **Pedidos:** \`${ventas.length}\`\n` +
                        `${E.arrow} ${E.money} **R$ gastados:** \`${formatRobux(ventas.reduce((s, v) => s + v.robux, 0))}\`\n` +
                        (promedio ? `${E.arrow} ${E.review} **Promedio:** \`${promedio}/5\`\n` : '') +
                        (tierCliente ? `${E.arrow} 🎖️ **Tier:** \`${tierCliente.emoji} ${tierCliente.label}\`\n` : '') +
                        `\n**Últimos pedidos:**\n` +
                        ultimas.map(v => `${E.line} \`#${v.id}\` **${v.producto}** — \`${formatRobux(v.robux)}\` — <t:${Math.floor(v.timestamp / 1000)}:d>`).join('\n')
                    ).setFooter({ text: `Mostrando ${ultimas.length} de ${ventas.length}` }).setTimestamp()] });
            }

            if (interaction.commandName === 'historial') {
                const rango   = interaction.options.getString('rango') ?? 'todo';
                const filtroU = interaction.options.getUser('usuario');
                let ventas = rango === 'todo' ? data.ventas : ventasPorRango(data.ventas, rango);
                if (filtroU) ventas = ventas.filter(v => v.clienteId === filtroU.id || v.vendedorId === filtroU.id);
                if (ventas.length === 0) return safeReply(interaction, { content: '📭 No hay pedidos con ese filtro.' });
                const ultimas = ventas.slice(-10).reverse();
                return safeReply(interaction, { embeds: [new EmbedBuilder().setColor('#5865F2').setTitle(`${E.orders}  Historial — ${guild.name}`)
                    .setDescription(
                        ultimas.map(v => {
                            const t = v.estado === 'cancelada' ? '~~' : '';
                            return `${E.line} \`#${v.id}\` ${t}**${v.producto}**${t} — \`${formatRobux(v.robux)}\` — <@${v.clienteId}>`;
                        }).join('\n') +
                        `\n\n${E.arrow} 🧾 **Total:** \`${ventas.length}\`\n${E.arrow} ${E.money} **R$ movidos:** \`${formatRobux(ventas.reduce((s, v) => s + v.robux, 0))}\``
                    ).setFooter({ text: `Últimos ${ultimas.length} de ${ventas.length}` }).setTimestamp()] });
            }

            if (interaction.commandName === 'reseña') {
                const ordenId = interaction.options.getInteger('orden');
                const venta = data.ventas.find(v => v.id === ordenId);
                if (!venta) return safeReply(interaction, { content: `⚠️ No existe la orden \`#${ordenId}\`.` });
                if (venta.clienteId !== user.id) return safeReply(interaction, { content: '⚠️ Solo el cliente puede dejar reseña.' });
                if (data.resenas?.find(r => r.ordenId === ordenId)) return safeReply(interaction, { content: '⚠️ Ya dejaste una reseña.' });
                return mostrarModalResena(interaction, ordenId);
            }

            if (interaction.commandName === 'resenas') {
                const objetivo = interaction.options.getUser('vendedor');
                const resenas  = data.resenas?.filter(r => r.vendedorId === objetivo.id) ?? [];
                if (resenas.length === 0) return safeReply(interaction, { content: `📭 **${objetivo.username}** no tiene reseñas.` });
                const promedio = (resenas.reduce((s, r) => s + r.estrellas, 0) / resenas.length).toFixed(1);
                return safeReply(interaction, { embeds: [new EmbedBuilder().setColor('#FEE75C').setTitle(`${E.review}  Reseñas de ${objetivo.username}`).setThumbnail(objetivo.displayAvatarURL({ dynamic: true }))
                    .setDescription(
                        `${E.arrow} **Promedio:** \`${promedio}/5\` *(${resenas.length} reseña${resenas.length !== 1 ? 's' : ''})*\n\n` +
                        resenas.slice(-5).reverse().map(r =>
                            `${E.line} ${estrellas(r.estrellas)} <@${r.clienteId}>` +
                            (r.comentario ? ` — *"${r.comentario}"*` : '') +
                            (r.imagen ? ` — 📸 [prueba](${r.imagen})` : '')
                        ).join('\n')
                    ).setFooter({ text: `Últimas ${Math.min(5, resenas.length)} de ${resenas.length}` }).setTimestamp()] });
            }

            if (interaction.commandName === 'cancelar') {
                if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages))
                    return safeReply(interaction, { content: '🚫 Necesitas **Gestionar mensajes**.' });
                const ordenId = interaction.options.getInteger('orden');
                const venta   = data.ventas.find(v => v.id === ordenId);
                if (!venta) return safeReply(interaction, { content: `⚠️ No existe la orden \`#${ordenId}\`.` });
                if (venta.estado === 'cancelada') return safeReply(interaction, { content: '⚠️ Ya está cancelada.' });
                return safeReply(interaction, { embeds: [new EmbedBuilder().setColor('#ED4245').setTitle(`⚠️  ¿Cancelar orden \`#${ordenId}\`?`)
                    .setDescription(
                        `${E.arrow} ${E.orders} **Producto:** \`${venta.producto}\`\n` +
                        `${E.arrow} 👤 **Cliente:**  <@${venta.clienteId}>\n` +
                        `${E.arrow} ${E.money} **Cantidad:** \`${formatRobux(venta.robux)}\`\n\n` +
                        `*Esta acción **no se puede deshacer**.*`
                    )],
                    components: [new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId(`cancelar_confirm_${ordenId}`).setLabel('Sí, cancelar').setStyle(ButtonStyle.Danger),
                        new ButtonBuilder().setCustomId(`cancelar_abort_${ordenId}`).setLabel('No, mantener').setStyle(ButtonStyle.Secondary)
                    )] });
            }

            if (interaction.commandName === 'exportar') {
                if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages))
                    return safeReply(interaction, { content: '🚫 Necesitas **Gestionar mensajes**.' });
                const rango  = interaction.options.getString('rango') ?? 'mes';
                const ventas = ventasPorRango(data.ventas, rango).filter(v => v.estado !== 'cancelada');
                if (ventas.length === 0) return safeReply(interaction, { content: '📭 No hay pedidos en ese período.' });
                const etiquetas = { hoy: 'Hoy', semana: 'Esta semana', mes: 'Este mes' };
                const totalRobux = ventas.reduce((s, v) => s + v.robux, 0);
                const lineas = [`REPORTE — ${etiquetas[rango] ?? rango}`, `Servidor: ${guild.name}`, `Generado: ${new Date().toLocaleString('es-MX')}`, '─'.repeat(60), ''];
                ventas.forEach(v => lineas.push(`#${v.id} | ${v.producto} | ${formatRobux(v.robux)} | ${v.precio} | ${v.metodo} | Cliente: ${v.clienteTag} | Operador: ${v.vendedorTag}`));
                lineas.push('', '─'.repeat(60), `TOTAL: ${ventas.length} pedidos | ${formatRobux(totalRobux)}`);
                const texto = lineas.join('\n');
                return interaction.reply({
                    content: `${E.export} **${ventas.length}** pedidos exportados:`,
                    files: [{ attachment: Buffer.from(texto, 'utf8'), name: `pedidos-${rango}.txt` }],
                    flags: 64
                });
            }

            if (interaction.commandName === 'perfil') {
                const objetivo     = interaction.options.getUser('usuario');
                const comoVendedor = data.ventas.filter(v => v.vendedorId === objetivo.id && v.estado !== 'cancelada');
                const comoCliente  = data.ventas.filter(v => v.clienteId  === objetivo.id && v.estado !== 'cancelada');
                const resenas      = data.resenas?.filter(r => r.vendedorId === objetivo.id) ?? [];
                const promedio     = resenas.length > 0 ? `${(resenas.reduce((s, r) => s + r.estrellas, 0) / resenas.length).toFixed(1)}/5` : 'Sin reseñas';
                const tierCliente  = getTier(data.analytics.porCliente?.[objetivo.id]?.compras ?? 0);
                const miembroObj   = guild.members.cache.get(objetivo.id);
                const esVip        = esClienteVip(miembroObj, data.config?.vipRoleId ?? null);
                return safeReply(interaction, { embeds: [new EmbedBuilder().setColor('#5865F2')
                    .setTitle(`👤  ${objetivo.username}${esVip ? `  ${E.diamante} VIP` : ''}`)
                    .setThumbnail(objetivo.displayAvatarURL({ dynamic: true }))
                    .setDescription(
                        `**Como operador**\n` +
                        `${E.arrow} 🧾 **Pedidos:**    \`${comoVendedor.length}\`\n` +
                        `${E.arrow} ${E.money} **R$ movidos:** \`${formatRobux(comoVendedor.reduce((s, v) => s + v.robux, 0))}\`\n` +
                        `${E.arrow} ${E.review} **Valoración:** \`${promedio}\`\n\n` +
                        `**Como cliente**\n` +
                        `${E.arrow} ${E.carrito} **Compras:**    \`${comoCliente.length}\`\n` +
                        `${E.arrow} ${E.money} **R$ gastados:** \`${formatRobux(comoCliente.reduce((s, v) => s + v.robux, 0))}\`\n` +
                        `${E.arrow} 🎖️ **Tier:**       \`${tierCliente ? `${tierCliente.emoji} ${tierCliente.label}` : 'Sin tier'}\`` +
                        (esVip ? `\n${E.arrow} 🎟️ **Sorteos:**    Doble entrada (VIP)` : '')
                    ).setFooter({ text: guild.name }).setTimestamp()] });
            }

            if (interaction.commandName === 'stats') {
                const rango  = interaction.options.getString('rango') ?? 'hoy';
                const ventas = ventasPorRango(data.ventas, rango).filter(v => v.estado !== 'cancelada');
                const etiquetas = { hoy: 'Hoy', semana: 'Esta semana', mes: 'Este mes' };
                return safeReply(interaction, { embeds: [new EmbedBuilder().setColor('#FEE75C').setTitle(`${E.stats}  Stats — ${etiquetas[rango] ?? rango}`)
                    .setDescription(
                        `${E.arrow} 🧾 **Pedidos:**         \`${ventas.length}\`\n` +
                        `${E.arrow} ${E.money} **R$ movidos:**      \`${formatRobux(ventas.reduce((s, v) => s + v.robux, 0))}\`\n` +
                        `${E.arrow} 👥 **Clientes únicos:** \`${new Set(ventas.map(v => v.clienteId)).size}\`\n\n` +
                        `${E.line} 📦 **Total histórico:** \`${data.ventas.filter(v => v.estado !== 'cancelada').length}\`\n` +
                        `${E.line} 💰 **Total R$ hist.:**  \`${formatRobux(data.analytics.totalRobux)}\``
                    ).setFooter({ text: guild.name }).setTimestamp()] });
            }

            if (interaction.commandName === 'top') {
                const tipo = interaction.options.getString('tipo') ?? 'vendedores';
                const por  = interaction.options.getString('por')  ?? 'ventas';
                const medallas = ['🥇', '🥈', '🥉'];
                if (tipo === 'compradores') {
                    const lista = Object.entries(data.analytics.porCliente ?? {})
                        .map(([id, d]) => ({ id, ...d })).filter(c => c.compras > 0)
                        .sort((a, b) => por === 'robux' ? b.robux - a.robux : b.compras - a.compras).slice(0, 10);
                    if (lista.length === 0) return safeReply(interaction, { content: '📭 Sin compras aún.' });
                    return safeReply(interaction, { embeds: [new EmbedBuilder().setColor('#FEE75C').setTitle(`${E.corona}  Top compradores`)
                        .setDescription(lista.map((c, i) => `> ${medallas[i] ?? `**${i + 1}.**`} <@${c.id}> — \`${c.compras}\` compra(s) • \`${formatRobux(c.robux)}\``).join('\n')).setTimestamp()] });
                }
                const lista = Object.entries(data.analytics.porVendedor)
                    .map(([id, d]) => ({ id, ...d })).filter(v => v.ventas > 0)
                    .sort((a, b) => por === 'robux' ? b.robux - a.robux : b.ventas - a.ventas).slice(0, 10);
                if (lista.length === 0) return safeReply(interaction, { content: '📭 Sin pedidos aún.' });
                return safeReply(interaction, { embeds: [new EmbedBuilder().setColor('#57F287').setTitle('🏆  Top operadores')
                    .setDescription(lista.map((v, i) => `> ${medallas[i] ?? `**${i + 1}.**`} <@${v.id}> — \`${v.ventas}\` pedido(s) • \`${formatRobux(v.robux)}\``).join('\n')).setTimestamp()] });
            }

            if (interaction.commandName === 'dashboard') {
                const hoy    = ventasPorRango(data.ventas, 'hoy').filter(v => v.estado !== 'cancelada');
                const semana = ventasPorRango(data.ventas, 'semana').filter(v => v.estado !== 'cancelada');
                const mes    = ventasPorRango(data.ventas, 'mes').filter(v => v.estado !== 'cancelada');
                const topV   = Object.entries(data.analytics.porVendedor).sort((a, b) => b[1].ventas - a[1].ventas)[0];
                const topC   = data.analytics.porCliente ? Object.entries(data.analytics.porCliente).sort((a, b) => b[1].compras - a[1].compras)[0] : null;
                const totalR = data.resenas?.length ?? 0;
                const prom   = totalR > 0 ? (data.resenas.reduce((s, r) => s + r.estrellas, 0) / totalR).toFixed(1) : null;
                return safeReply(interaction, { embeds: [new EmbedBuilder().setColor('#5865F2')
                    .setTitle(`${E.analytics}  Dashboard — ${guild.name}`)
                    .setThumbnail(guild.iconURL({ dynamic: true }) ?? null)
                    .setDescription(
                        `${E.arrow} 🌅 **Hoy:**         \`${hoy.length}\` pedidos • \`${formatRobux(hoy.reduce((s, v) => s + v.robux, 0))}\`\n` +
                        `${E.arrow} 📅 **Esta semana:** \`${semana.length}\` pedidos • \`${formatRobux(semana.reduce((s, v) => s + v.robux, 0))}\`\n` +
                        `${E.arrow} 🗓️ **Este mes:**    \`${mes.length}\` pedidos • \`${formatRobux(mes.reduce((s, v) => s + v.robux, 0))}\`\n` +
                        `${E.arrow} 📦 **Histórico:**   \`${data.analytics.totalVentas}\` pedidos • \`${formatRobux(data.analytics.totalRobux)}\`\n\n` +
                        `${E.arrow} 🏆 **Top operador:** ${topV ? `<@${topV[0]}> (\`${topV[1].ventas}\` pedidos)` : '`Sin datos`'}\n` +
                        `${E.arrow} ${E.corona} **Top cliente:**  ${topC ? `<@${topC[0]}> (\`${topC[1].compras}\` compras)` : '`Sin datos`'}` +
                        (prom ? `\n${E.arrow} ${E.review} **Valoración:**  \`${prom}/5\` *(${totalR} reseñas)*` : '')
                    ).setFooter({ text: 'Aurex' }).setTimestamp()] });
            }

            if (interaction.commandName === 'afk') {
                const motivo = interaction.options.getString('motivo') ?? 'Sin motivo';
                if (data.afk[user.id]) {
                    const anterior = data.afk[user.id];
                    data.afk[user.id] = { motivo, tiempo: Date.now(), menciones: [] };
                    saveData(guild.id, data);
                    return safeReplyPublic(interaction, { embeds: [new EmbedBuilder()
                        .setColor('#FEE75C')
                        .setDescription(
                            `### ${E.advertencia}  AFK actualizado\n\n` +
                            `${E.arrow} AFK anterior removido: *${anterior.motivo}*\n` +
                            `${E.arrow} Nuevo AFK activo: *${motivo}*`
                        ).setTimestamp()] });
                }
                data.afk[user.id] = { motivo, tiempo: Date.now(), menciones: [] };
                saveData(guild.id, data);
                try {
                    const miembro = guild.members.cache.get(user.id);
                    if (miembro && guild.members.me.permissions.has(PermissionFlagsBits.ManageNicknames)) {
                        // FIX #3: evitar doble prefijo [AFK] en el nick
                        const nickActual = miembro.nickname ?? miembro.user.username;
                        const nickLimpio = nickActual.startsWith('[AFK] ')
                            ? nickActual.replace('[AFK] ', '')
                            : nickActual;
                        const nickBase = nickLimpio.slice(0, 25);
                        await miembro.setNickname(`[AFK] ${nickBase}`).catch(() => {});
                    }
                } catch { /* sin permisos */ }
                return safeReplyPublic(interaction, { embeds: [new EmbedBuilder()
                    .setColor('#3498DB')
                    .setTitle('💤  AFK activado')
                    .setDescription(
                        `${E.arrow} 👤 **${user.username}** está ahora en modo AFK\n` +
                        `${E.arrow} 📝 **Motivo:** *${motivo}*\n` +
                        `${E.arrow} ${E.reloj} **Desde:** <t:${Math.floor(Date.now() / 1000)}:R>\n\n` +
                        `${E.line} *Escribe cualquier mensaje para volver del AFK.*\n` +
                        `${E.line} *Las menciones serán guardadas y te avisarán al regresar.*`
                    )
                    .setThumbnail(user.displayAvatarURL({ dynamic: true }))
                    .setFooter({ text: 'Aurex • AFK' })
                    .setTimestamp()] });
            }

            if (interaction.commandName === 'anuncio') {
                if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages))
                    return safeReply(interaction, { content: '🚫 Necesitas **Gestionar mensajes**.' });
                const imagenUrl = interaction.options.getString('imagen') ?? null;
                const embed = new EmbedBuilder()
                    .setColor('#ED4245')
                    .setTitle(`📢  ${interaction.options.getString('titulo')}`)
                    .setDescription(interaction.options.getString('mensaje'))
                    .setFooter({ text: `Anuncio por ${user.tag} · Aurex` })
                    .setTimestamp();
                if (imagenUrl) { try { new URL(imagenUrl); embed.setImage(imagenUrl); } catch {} }
                const opts = { embeds: [embed] };
                const textoBoton  = interaction.options.getString('texto_boton');
                const enlaceBoton = interaction.options.getString('enlace_boton');
                if (textoBoton && enlaceBoton) {
                    opts.components = [new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setLabel(textoBoton).setURL(enlaceBoton).setStyle(ButtonStyle.Link)
                    )];
                }
                await safeReply(interaction, { content: '✅ Anuncio enviado.' });
                return interaction.channel.send(opts).catch(() => {});
            }

            if (interaction.commandName === 'clear') {
                if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages))
                    return safeReply(interaction, { content: '🚫 Necesitas **Gestionar mensajes**.' });
                const cantidad = interaction.options.getInteger('cantidad');
                if (cantidad < 1 || cantidad > 100) return safeReply(interaction, { content: '⚠️ Entre 1 y 100.' });
                const ok = await safeDefer(interaction, true);
                if (!ok) return;
                // FIX #5: error específico para mensajes >14 días
                const deleted = await interaction.channel.bulkDelete(cantidad, true).catch(e => {
                    if (e.code === 50034)
                        interaction.editReply({ content: '⚠️ No se pueden borrar mensajes con más de **14 días** de antigüedad.' });
                    else
                        interaction.editReply({ content: `⚠️ Error al borrar mensajes: \`${e.message}\`` });
                    return null;
                });
                if (deleted)
                    return interaction.editReply({ content: `🗑️ **${deleted.size}** mensaje(s) eliminados.` });
                return;
            }

            if (interaction.commandName === 'setlog') {
                if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator))
                    return safeReply(interaction, { content: '🚫 Solo administradores.' });
                data.config.logChannelId = interaction.options.getChannel('canal').id;
                saveData(guild.id, data);
                return safeReply(interaction, { content: `${E.settings} Canal de logs: <#${data.config.logChannelId}>` });
            }
            if (interaction.commandName === 'setresenas') {
                if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator))
                    return safeReply(interaction, { content: '🚫 Solo administradores.' });
                data.config.resenaChannelId = interaction.options.getChannel('canal').id;
                saveData(guild.id, data);
                return safeReply(interaction, { content: `${E.settings} Canal de reseñas: <#${data.config.resenaChannelId}>` });
            }
            if (interaction.commandName === 'configdm') {
                if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator))
                    return safeReply(interaction, { content: '🚫 Solo administradores.' });
                data.config.dmEnabled = interaction.options.getBoolean('estado');
                saveData(guild.id, data);
                return safeReply(interaction, { content: `${E.settings} DMs: **${data.config.dmEnabled ? 'activados ✅' : 'desactivados ❌'}**` });
            }
            if (interaction.commandName === 'setdm') {
                if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator))
                    return safeReply(interaction, { content: '🚫 Solo administradores.' });
                const texto = interaction.options.getString('texto');
                data.config.dmCierreTexto = texto;
                saveData(guild.id, data);
                return safeReply(interaction, { embeds: [new EmbedBuilder().setColor('#57F287')
                    .setTitle(`${E.settings}  Mensaje de cierre actualizado`)
                    .setDescription(`${E.line} ${texto.replace(/\n/g, `\n${E.line} `)}\n\n*Variables: \`{usuario}\` \`{servidor}\`*`)] });
            }

            if (interaction.commandName === 'stock') {
                const stock = data.stock ?? [];
                if (stock.length === 0) return safeReply(interaction, { content: '📭 El stock está vacío.' });
                const lineas = stock.map(item =>
                    `${E.arrowR} **${item.nombre}**\n` +
                    `${E.arrow} 🔢 Cantidad: \`${item.cantidad}\`\n` +
                    `${E.arrow} 💵 Precio:   \`${item.precio ?? 'No especificado'}\`\n` +
                    `${E.arrow} 📝 Notas:    \`${item.notas ?? '—'}\``
                ).join('\n\n');
                return safeReply(interaction, { embeds: [new EmbedBuilder().setColor('#5865F2')
                    .setTitle(`${E.stock}  Stock disponible`)
                    .setDescription(lineas)
                    .setFooter({ text: `${stock.length} ítem(s) • ${guild.name} · Aurex` })
                    .setTimestamp()] });
            }

            if (interaction.commandName === 'stock-admin') {
                if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator))
                    return safeReply(interaction, { content: '🚫 Solo administradores.' });
                const accion   = interaction.options.getString('accion');
                const nombre   = interaction.options.getString('nombre');
                const cantidad = interaction.options.getInteger('cantidad');
                const precio   = interaction.options.getString('precio');
                const notas    = interaction.options.getString('notas');
                if (!data.stock) data.stock = [];
                if (accion === 'agregar') {
                    data.stock.push({ nombre, cantidad: cantidad ?? 0, precio: precio ?? null, notas: notas ?? null });
                    saveData(guild.id, data);
                    return safeReply(interaction, { embeds: [new EmbedBuilder().setColor('#57F287')
                        .setTitle(`${E.stock}  Ítem agregado`)
                        .setDescription(`${E.arrow} ${E.caja} **${nombre}** — \`${cantidad ?? 0}\` unidades — \`${precio ?? 'Sin precio'}\``)] });
                }
                if (accion === 'editar') {
                    const idx = data.stock.findIndex(i => i.nombre.toLowerCase() === nombre?.toLowerCase());
                    if (idx === -1) return safeReply(interaction, { content: `⚠️ No existe \`${nombre}\`.` });
                    if (cantidad !== null && cantidad !== undefined) data.stock[idx].cantidad = cantidad;
                    if (precio  !== null && precio  !== undefined) data.stock[idx].precio   = precio;
                    if (notas   !== null && notas   !== undefined) data.stock[idx].notas    = notas;
                    saveData(guild.id, data);
                    return safeReply(interaction, { content: `${E.check} \`${data.stock[idx].nombre}\` actualizado.` });
                }
                if (accion === 'eliminar') {
                    const idx = data.stock.findIndex(i => i.nombre.toLowerCase() === nombre?.toLowerCase());
                    if (idx === -1) return safeReply(interaction, { content: `⚠️ No existe \`${nombre}\`.` });
                    data.stock.splice(idx, 1); saveData(guild.id, data);
                    return safeReply(interaction, { content: `🗑️ **${nombre}** eliminado.` });
                }
                if (accion === 'limpiar') {
                    data.stock = []; saveData(guild.id, data);
                    return safeReply(interaction, { content: '🗑️ Stock limpiado.' });
                }
            }

            if (interaction.commandName === 'stock-bulk') {
                if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator))
                    return safeReply(interaction, { content: '🚫 Solo administradores.' });
                const modal = new ModalBuilder().setCustomId('stock_bulk_modal').setTitle(`${E.caja} Carga masiva de stock`);
                modal.addComponents(
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder().setCustomId('items_texto').setLabel('Ítems — uno por línea').setStyle(TextInputStyle.Paragraph)
                            .setPlaceholder('Nombre | cantidad | precio | notas\n\nEjemplos:\nRobux 1000 | 10 | $5 USD | Entrega inmediata\nCuenta Premium | 3 | $15 USD')
                            .setRequired(true).setMaxLength(3000)
                    ),
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder().setCustomId('modo_valor').setLabel('Modo: "agregar" o "reemplazar"').setStyle(TextInputStyle.Short)
                            .setPlaceholder('agregar').setRequired(false).setMaxLength(10)
                    )
                );
                return interaction.showModal(modal);
            }
        });
    } catch (e) { if (!isIgnorableError(e)) console.error('❌ interactionCreate:', e?.message); }
});

// ─── Helper: modal de reseña ──────────────────────────────────────────────────
function mostrarModalResena(interaction, ordenId) {
    const modal = new ModalBuilder().setCustomId(`modal_resena_${ordenId}`).setTitle(`⭐ Reseña — Orden #${ordenId}`);
    modal.addComponents(
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('estrellas').setLabel('Calificación (1 a 5 ⭐)').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(1).setPlaceholder('Número del 1 al 5')),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('comentario').setLabel('Comentario (opcional)').setStyle(TextInputStyle.Paragraph).setRequired(false).setMaxLength(300).setPlaceholder('Cuéntanos tu experiencia...')),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('imagen_url').setLabel('URL de imagen / prueba (opcional)').setStyle(TextInputStyle.Short).setRequired(false).setPlaceholder('https://imgur.com/...'))
    );
    return interaction.showModal(modal).catch(() => {});
}

// ─── Login ────────────────────────────────────────────────────────────────────
client.login(process.env.TOKEN).catch(err => {
    console.error('❌ FATAL: No se pudo conectar a Discord:', err.message);
    console.error('   Verifica que el TOKEN sea válido y que el bot tenga los intents habilitados en el portal de Discord.');
    process.exit(1);
});