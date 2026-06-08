const {
    Client, GatewayIntentBits, EmbedBuilder, PermissionFlagsBits,
    ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder,
    TextInputBuilder, TextInputStyle, StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder, ChannelType
} = require('discord.js');
const fs   = require('fs');
const path = require('path');
require('dotenv').config();

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
    // ── Nuevos emojis ──
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
    // ── Decorativos ──
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
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
const _cache = new Map();

function loadData(guildId) {
    if (_cache.has(`d_${guildId}`)) return _cache.get(`d_${guildId}`);
    const file = path.join(DATA_DIR, `${guildId}.json`);
    if (!fs.existsSync(file)) { const d = defaultData(); _cache.set(`d_${guildId}`, d); return d; }
    try { const d = JSON.parse(fs.readFileSync(file, 'utf8')); _cache.set(`d_${guildId}`, d); return d; }
    catch { return defaultData(); }
}
function saveData(guildId, data) {
    _cache.set(`d_${guildId}`, data);
    fs.writeFileSync(path.join(DATA_DIR, `${guildId}.json`), JSON.stringify(data), 'utf8');
}
function defaultData() {
    return {
        ventas: [], resenas: [],
        config: { logChannelId: null, dmEnabled: true, resenaChannelId: null, dmCierreTexto: null, tierRoles: {}, vipRoleId: null },
        afk: {}, stock: [],
        analytics: { totalVentas: 0, totalRobux: 0, porVendedor: {}, porCliente: {} },
        sorteos: []
    };
}
function loadTickets(guildId) {
    if (_cache.has(`t_${guildId}`)) return _cache.get(`t_${guildId}`);
    const file = path.join(DATA_DIR, `tickets_${guildId}.json`);
    if (!fs.existsSync(file)) { const d = defaultTickets(); _cache.set(`t_${guildId}`, d); return d; }
    try { const d = JSON.parse(fs.readFileSync(file, 'utf8')); _cache.set(`t_${guildId}`, d); return d; }
    catch { return defaultTickets(); }
}
function saveTickets(guildId, data) {
    _cache.set(`t_${guildId}`, data);
    fs.writeFileSync(path.join(DATA_DIR, `tickets_${guildId}.json`), JSON.stringify(data), 'utf8');
}
function defaultTickets() {
    return {
        tickets: [], cooldowns: {},
        config: { panelMessageId: null, panelChannelId: null, categoryId: null, logChannelId: null, vendedorRoleId: null, staffRoleId: null }
    };
}

// ─── Manejo global de errores ─────────────────────────────────────────────────
process.on('unhandledRejection', (err) => {
    if (err?.code === 10062 || err?.code === 40060) return;
    console.error('❌ [unhandledRejection]', err?.message ?? err);
});
process.on('uncaughtException', (err) => {
    if (err?.code === 10062 || err?.code === 40060 || err?.message?.includes('Unknown interaction')) return;
    console.error('❌ [uncaughtException]', err?.message ?? err);
});

// ─── Helpers de interacción ───────────────────────────────────────────────────
// FIX: flags: 64 en lugar de ephemeral:true (deprecated)
async function safeReply(interaction, opts) {
    const normalized = { ...opts };
    if (normalized.ephemeral === true) { normalized.flags = 64; delete normalized.ephemeral; }
    try {
        if (interaction.replied)  return await interaction.followUp({ ...normalized, flags: normalized.flags ?? 64 });
        if (interaction.deferred) return await interaction.editReply(normalized);
        return await interaction.reply({ ...normalized, flags: normalized.flags ?? 64 });
    } catch (e) {
        if (e?.code === 10062 || e?.code === 40060) return;
        console.warn('⚠️ [safeReply]', e?.message);
    }
}

async function safeDefer(interaction, ephemeral = false) {
    if (interaction.deferred || interaction.replied) return true;
    try {
        await interaction.deferReply(ephemeral ? { flags: 64 } : {});
        return true;
    } catch (e) {
        if (e?.code === 10062 || e?.code === 40060) return false;
        console.warn('⚠️ [safeDefer]', e?.message);
        return false;
    }
}

async function safeHandle(interaction, fn) {
    try {
        await fn();
    } catch (err) {
        if (err?.code === 10062 || err?.code === 40060 || err?.message?.includes('Unknown interaction')) return;
        console.error(`❌ [safeHandle] ${interaction.commandName ?? interaction.customId ?? '?'}:`, err?.message ?? err);
        const esFaltaPermisos = err?.code === 50013 || err?.message?.toLowerCase().includes('missing permissions') || err?.message?.toLowerCase().includes('missing access');
        await safeReply(interaction, {
            content: esFaltaPermisos
                ? '⚠️ **Faltan permisos.** El bot necesita: `Gestionar canales` `Gestionar roles` `Ver canales` `Enviar mensajes`.'
                : '⚠️ Ocurrió un error inesperado. Intenta de nuevo.'
        });
    }
}

const cooldowns = new Map();
function checkCooldown(guildId, userId, comando, segundos) {
    const key = `${guildId}-${userId}-${comando}`;
    const ahora = Date.now();
    if (cooldowns.has(key)) {
        const restante = Math.ceil((cooldowns.get(key) + segundos * 1000 - ahora) / 1000);
        if (restante > 0) return restante;
    }
    cooldowns.set(key, ahora);
    return 0;
}

// ─── Utilidades ───────────────────────────────────────────────────────────────
const PREFIX = '$';
function parseRobux(str) {
    if (!str) return null;
    const s = str.toLowerCase().trim();
    if (s.endsWith('k')) return Math.round(parseFloat(s) * 1_000);
    if (s.endsWith('m')) return Math.round(parseFloat(s) * 1_000_000);
    const n = parseInt(s.replace(/,/g, ''), 10);
    return isNaN(n) ? null : n;
}
function formatRobux(n) {
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
    return ventas.filter(v => (ahora - v.timestamp) <= (rangos[rango] ?? Infinity));
}
function tiempoRelativo(ms) {
    const min = Math.floor(ms / 60000); const hrs = Math.floor(min / 60); const dias = Math.floor(hrs / 24);
    if (dias > 0) return `${dias}d ${hrs % 24}h`; if (hrs > 0) return `${hrs}h ${min % 60}m`; return `${min}m`;
}
function estrellas(n) { return '⭐'.repeat(Math.min(n, 5)); }
function calcDuracion(start, end) {
    const ms = end - start; const min = Math.floor(ms / 60000); const hrs = Math.floor(min / 60); const dias = Math.floor(hrs / 24);
    if (dias > 0) return `${dias}d ${hrs % 24}h`; if (hrs > 0) return `${hrs}h ${min % 60}m`; return `${min}m`;
}
function getTier(compras) {
    let tier = null;
    for (const t of TIER_UMBRALES) { if (compras >= t.minCompras) tier = t; }
    return tier;
}
function esClienteVip(miembro, vipRoleId) {
    if (!vipRoleId || !miembro) return false;
    return miembro.roles.cache.has(vipRoleId);
}

async function actualizarTier(guild, userId, comprasTotal, tierRoles) {
    if (!tierRoles || Object.keys(tierRoles).length === 0) return;
    const tier = getTier(comprasTotal);
    if (!tier) return;
    const roleId = tierRoles[tier.nombre];
    if (!roleId) return;
    try {
        const miembro = guild.members.cache.get(userId) ?? await guild.members.fetch(userId).catch(() => null);
        if (!miembro) return;
        for (const t of TIER_UMBRALES) {
            const rId = tierRoles[t.nombre];
            if (rId && rId !== roleId && miembro.roles.cache.has(rId)) await miembro.roles.remove(rId).catch(() => {});
        }
        if (!miembro.roles.cache.has(roleId)) {
            await miembro.roles.add(roleId);
            console.log(`🎖️ Tier [${tier.label}] -> ${miembro.user.tag} en ${guild.name}`);
        }
    } catch (err) { console.warn('⚠️ No se pudo asignar tier:', err?.message); }
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
                `${E.arrow} ${E.relojArena} Cooldown de **10 minutos** entre tickets.\n` +
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
                `**\`/sorteo\`**\n${E.arrow} Crea un sorteo. VIPs tienen doble entrada.\n\n` +
                `**\`/clear [cantidad]\`**\n${E.arrow} Borra hasta 100 mensajes.\n\n` +
                `**\`/ping\`**\n${E.arrow} Latencia actual del bot.`
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
        .setAuthor({ name: 'Aurex Bot', iconURL: guild?.client?.user?.displayAvatarURL() ?? undefined })
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
        const canal = guild.channels.cache.get(tdata.config.logChannelId) ?? await guild.channels.fetch(tdata.config.logChannelId).catch(() => null);
        if (!canal) return;
        await canal.send({ embeds: [embedLog], ...(archivo ? { files: [archivo] } : {}) });
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
                    await mensajeAnterior.edit({ embeds: [embedPanel], components: [rowPanel] });
                    panelActualizado = true;
                    if (canalAnterior.id !== canal.id) { await mensajeAnterior.delete().catch(() => {}); panelActualizado = false; }
                }
            }
        } catch { panelActualizado = false; }
    }
    if (!panelActualizado) {
        const msg = await canal.send({ embeds: [embedPanel], components: [rowPanel] });
        tdata.config.panelMessageId = msg.id;
        tdata.config.panelChannelId = canal.id;
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

// FIX PRINCIPAL: abrirTicket recibe la interacción ya deferida/respondida
// y NUNCA llama reply/deferReply por sí mismo — usa safeReply que detecta el estado.
async function abrirTicket(interaction, categoriaKey, datosModal = null) {
    const guild = interaction.guild;
    const user  = interaction.user;
    const tdata = loadTickets(guild.id);
    const cat   = CATEGORIAS[categoriaKey];

    // Ticket ya abierto
    const ticketAbierto = tdata.tickets.find(t => t.userId === user.id && t.estado === 'abierto');
    if (ticketAbierto) {
        const existe = guild.channels.cache.get(ticketAbierto.channelId) ?? await guild.channels.fetch(ticketAbierto.channelId).catch(() => null);
        if (existe) return safeReply(interaction, { content: `⚠️ Ya tienes un ticket abierto: <#${ticketAbierto.channelId}>` });
        ticketAbierto.estado = 'cerrado'; ticketAbierto.cerradoPor = 'Sistema'; ticketAbierto.cerradoAt = Date.now();
        saveTickets(guild.id, tdata);
    }

    // Cooldown
    if (!tdata.cooldowns) tdata.cooldowns = {};
    const restante = (10 * 60 * 1000) - (Date.now() - (tdata.cooldowns[user.id] ?? 0));
    if (restante > 0 && tdata.cooldowns[user.id])
        return safeReply(interaction, { content: `${E.relojArena} Espera **${Math.ceil(restante / 60000)} min** antes de abrir otro ticket.` });

    // Permisos del bot
    const botMember = guild.members.me;
    if (!botMember.permissions.has(PermissionFlagsBits.ManageChannels))
        return safeReply(interaction, { content: '⚠️ **Faltan permisos.** El bot necesita **Gestionar canales**.' });

    // Crear canal
    const nombreCanal = `${cat.prefijo}-${user.username.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20) || 'usuario'}`;
    const permisos = [
        { id: guild.id,     deny:  [PermissionFlagsBits.ViewChannel] },
        { id: user.id,      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
        { id: botMember.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageMessages, PermissionFlagsBits.ManageChannels] }
    ];
    if (tdata.config.staffRoleId)    permisos.push({ id: tdata.config.staffRoleId,    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageMessages] });
    if (categoriaKey === 'comprar' && tdata.config.vendedorRoleId) permisos.push({ id: tdata.config.vendedorRoleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] });

    const canalTicket = await guild.channels.create({ name: nombreCanal, type: ChannelType.GuildText, parent: tdata.config.categoryId ?? null, permissionOverwrites: permisos });
    const ticketId = tdata.tickets.length + 1;
    tdata.tickets.push({ id: ticketId, channelId: canalTicket.id, userId: user.id, userTag: user.tag, categoria: categoriaKey, estado: 'abierto', timestamp: Date.now(), datosModal, ultimaActividad: Date.now(), recordatorioEnviado: false });
    saveTickets(guild.id, tdata);

    // Mensaje de bienvenida
    let descripcion = cat.bienvenida(user.username);
    if (datosModal) {
        descripcion +=
            `\n\n**📋 Datos de tu pedido:**\n` +
            `${E.arrow} ${E.money} **Cantidad:**    \`${datosModal.cantidad}\`\n` +
            `${E.arrow} 💵 **Presupuesto:** \`${datosModal.precio}\`\n` +
            `${E.arrow} ${E.tarjeta} **Método:**      \`${datosModal.metodo}\``;
    }
    const embedBienvenida = new EmbedBuilder().setColor(cat.color).setImage(BANNER_URL).setDescription(descripcion).setFooter({ text: `${E.ticket} Ticket #${ticketId} • ${guild.name} · Aurex` }).setTimestamp();
    const rowCerrar = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`ticket_cerrar_${ticketId}`).setLabel('🔒 Cerrar ticket').setStyle(ButtonStyle.Danger));
    const menciones = [`<@${user.id}>`];
    if (categoriaKey === 'comprar' && tdata.config.vendedorRoleId) menciones.push(`<@&${tdata.config.vendedorRoleId}>`);
    else if (tdata.config.staffRoleId) menciones.push(`<@&${tdata.config.staffRoleId}>`);
    await canalTicket.send({ content: menciones.join(' '), embeds: [embedBienvenida], components: [rowCerrar] });

    await logTicket(guild, tdata, new EmbedBuilder().setColor('#57F287')
        .setTitle(`${E.ticket}  Ticket #${ticketId} abierto`)
        .setDescription(
            `${E.arrow} 👤 **Usuario:**   <@${user.id}> (\`${user.tag}\`)\n` +
            `${E.arrow} 🗂️ **Categoría:** ${cat.emoji} \`${cat.label}\`\n` +
            `${E.arrow} 📌 **Canal:**     <#${canalTicket.id}>`
        ).setTimestamp());

    // FIX: solo safeReply, nunca reply directo aquí
    return safeReply(interaction, { content: `${E.check} Tu ticket fue creado: <#${canalTicket.id}>` });
}

async function cerrarTicket(interaction, ticketId) {
    const guild  = interaction.guild;
    const tdata  = loadTickets(guild.id);
    const ticket = tdata.tickets.find(t => t.id === ticketId);
    if (!ticket || ticket.estado === 'cerrado') return safeReply(interaction, { content: '⚠️ Este ticket ya fue cerrado.' });
    const esAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
    const esStaff = tdata.config.staffRoleId ? interaction.member.roles.cache.has(tdata.config.staffRoleId) : false;
    if (!esAdmin && !esStaff && interaction.user.id !== ticket.userId) return safeReply(interaction, { content: '🚫 Sin permiso para cerrar este ticket.' });
    const ok = await safeDefer(interaction);
    if (!ok) return;
    const mensajes = await interaction.channel.messages.fetch({ limit: 100 });
    const cat = CATEGORIAS[ticket.categoria];
    let transcript = `TRANSCRIPT — Ticket #${ticket.id} (${cat.label})\nUsuario: ${ticket.userTag}\nCerrado por: ${interaction.user.tag}\nFecha: ${new Date().toLocaleString('es-MX')}\nDuración: ${calcDuracion(ticket.timestamp, Date.now())}\n${'─'.repeat(60)}\n\n`;
    mensajes.reverse().forEach(m => { if (m.author.bot) return; transcript += `[${new Date(m.createdTimestamp).toLocaleString('es-MX')}] ${m.author.tag}: ${m.content}\n`; if (m.embeds.length > 0) transcript += `  [embed]\n`; });
    if (!tdata.cooldowns) tdata.cooldowns = {};
    tdata.cooldowns[ticket.userId] = Date.now();
    ticket.estado = 'cerrado'; ticket.cerradoPor = interaction.user.tag; ticket.cerradoAt = Date.now();
    saveTickets(guild.id, tdata);
    await interaction.editReply({ embeds: [new EmbedBuilder().setColor('#ED4245').setTitle('🔒  Ticket cerrado')
        .setDescription(`${E.arrow} Cerrado por <@${interaction.user.id}>\n${E.arrow} El canal se eliminará en **5 segundos**.`)
        .setTimestamp()] });
    try {
        const gdata = loadData(guild.id);
        const dmTexto = gdata.config.dmCierreTexto ?? `¡Hola, **{usuario}**! 👋\n\nEsperamos haberte atendido de la mejor manera en **{servidor}**.\n\n*Si tuviste algún inconveniente, abre un nuevo ticket.*\n\n¡Gracias por confiar en nosotros! 💙`;
        const embedDM = new EmbedBuilder().setColor('#5865F2')
            .setAuthor({ name: guild.name, iconURL: guild.iconURL({ dynamic: true }) ?? undefined })
            .setTitle(`${E.ticket}  Tu ticket fue cerrado`)
            .setThumbnail(guild.iconURL({ dynamic: true }) ?? null)
            .setDescription(
                `${E.arrow} **Servidor:**    \`${guild.name}\`\n` +
                `${E.arrow} **Categoría:**   ${cat.emoji} \`${cat.label}\`\n` +
                `${E.arrow} **Cerrado por:** \`${interaction.user.tag}\`\n` +
                `${E.arrow} **Duración:**    \`${calcDuracion(ticket.timestamp, Date.now())}\`\n\n` +
                `━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                dmTexto.replace('{usuario}', ticket.userTag.split('#')[0]).replace('{servidor}', guild.name)
            ).setFooter({ text: `${guild.name} · powered by Aurex` }).setTimestamp();
        const buffer = Buffer.from(transcript, 'utf8');
        const miembro = guild.members.cache.get(ticket.userId) ?? await guild.members.fetch(ticket.userId).catch(() => null);
        if (miembro) await enviarDM(miembro.user, embedDM, { files: [{ attachment: buffer, name: `transcript-ticket${ticketId}.txt` }] });
    } catch { console.warn('⚠️ DM cierre fallido'); }
    const buffer = Buffer.from(transcript, 'utf8');
    await logTicket(guild, tdata,
        new EmbedBuilder().setColor('#ED4245').setTitle(`${E.ticket}  Ticket #${ticketId} cerrado`)
            .setDescription(
                `${E.arrow} 👤 **Usuario:**    <@${ticket.userId}> (\`${ticket.userTag}\`)\n` +
                `${E.arrow} 🗂️ **Categoría:**  ${cat.emoji} \`${cat.label}\`\n` +
                `${E.arrow} 🔒 **Cerrado por:** \`${interaction.user.tag}\`\n` +
                `${E.arrow} ⏱️ **Duración:**   \`${calcDuracion(ticket.timestamp, Date.now())}\``
            ).setTimestamp(),
        { attachment: buffer, name: `transcript-ticket${ticketId}.txt` }
    );
    setTimeout(() => { interaction.channel.delete().catch(() => {}); }, 5000);
}

// ─── FIX: handleTicketInteraction sin doble defer/reply ───────────────────────
// El flujo correcto:
// StringSelectMenu (sin modal) → deferReply UNA sola vez aquí → abrirTicket (usa safeReply → editReply)
// StringSelectMenu (con modal)  → showModal (NO deferReply antes) → modal submit → deferReply → abrirTicket
async function handleTicketInteraction(interaction) {
    // ── Select menu ──────────────────────────────────────────────────────────
    if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_categoria') {
        const categoriaKey = interaction.values[0];
        const cat = CATEGORIAS[categoriaKey];

        if (cat.modal) {
            // NO hacer defer antes de showModal — Discord no lo permite
            const modal = new ModalBuilder().setCustomId(`ticket_modal_${categoriaKey}`).setTitle(`Ticket — ${cat.label}`);
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('cantidad').setLabel('¿Cuánto deseas adquirir?').setPlaceholder('Ej: 1000, 5k').setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('precio').setLabel('¿Cuál es tu presupuesto?').setPlaceholder('Ej: $5 USD, 130 MXN').setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('metodo').setLabel('¿Método de pago?').setPlaceholder('Ej: PayPal, Binance, Mercado Pago').setStyle(TextInputStyle.Short).setRequired(true))
            );
            return interaction.showModal(modal);
        }

        // Sin modal: defer UNA vez, luego abrirTicket usa safeReply → editReply
        const ok = await safeDefer(interaction, true);
        if (!ok) return;
        return abrirTicket(interaction, categoriaKey);
    }

    // ── Modal submit ─────────────────────────────────────────────────────────
    if (interaction.isModalSubmit() && interaction.customId.startsWith('ticket_modal_')) {
        const ok = await safeDefer(interaction, true);
        if (!ok) return;
        return abrirTicket(interaction, interaction.customId.replace('ticket_modal_', ''), {
            cantidad: interaction.fields.getTextInputValue('cantidad'),
            precio:   interaction.fields.getTextInputValue('precio'),
            metodo:   interaction.fields.getTextInputValue('metodo')
        });
    }

    // ── Botón cerrar ─────────────────────────────────────────────────────────
    if (interaction.isButton() && interaction.customId.startsWith('ticket_cerrar_'))
        return cerrarTicket(interaction, parseInt(interaction.customId.replace('ticket_cerrar_', '')));
}

// ─── Stock bulk ───────────────────────────────────────────────────────────────
async function handleStockBulkModal(interaction) {
    const texto = interaction.fields.getTextInputValue('items_texto');
    const modo  = interaction.fields.getTextInputValue('modo_valor').trim().toLowerCase();
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
        if (idx !== -1) { data.stock[idx] = { nombre, cantidad: isNaN(cantidad) ? data.stock[idx].cantidad : cantidad, precio: precio ?? data.stock[idx].precio, notas: notas ?? data.stock[idx].notas }; }
        else data.stock.push({ nombre, cantidad: isNaN(cantidad) ? 0 : cantidad, precio, notas });
        agregados.push(nombre);
    }
    saveData(interaction.guild.id, data);
    return safeReply(interaction, { content: '', embeds: [new EmbedBuilder().setColor('#57F287')
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
            `${E.line} *${E.diamante} Clientes VIP tienen el doble de entradas (máx. 20).*\n\n` +
            (terminado && sorteo.ganadores?.length
                ? `**🏆 Ganador${sorteo.ganadores.length > 1 ? 'es' : ''}:**\n${sorteo.ganadores.map(id => `${E.arrow} <@${id}>`).join('\n')}`
                : terminado ? `${E.arrow} *Sin participantes para elegir ganador.*` : '')
        )
        .setImage(sorteo.imagen ?? BANNER_URL)
        .setFooter({ text: `${guildName} · Aurex · ID: ${sorteo.id}` })
        .setTimestamp();
}

function elegirGanadores(participantes, cantidad) {
    const pool = [];
    for (const p of participantes) { for (let i = 0; i < p.entradas; i++) pool.push(p.userId); }
    if (pool.length === 0) return [];
    const ganadores = new Set();
    const maxIntentos = pool.length * 3; let intentos = 0;
    while (ganadores.size < Math.min(cantidad, participantes.length) && intentos < maxIntentos) {
        ganadores.add(pool[Math.floor(Math.random() * pool.length)]); intentos++;
    }
    return [...ganadores];
}

async function handleSorteoParticipar(interaction, sorteoId) {
    const data = loadData(interaction.guild.id);
    if (!data.sorteos) data.sorteos = [];
    const sorteo = data.sorteos.find(s => s.id === sorteoId);
    if (!sorteo) return safeReply(interaction, { content: '⚠️ Este sorteo ya no existe.' });
    if (Date.now() >= sorteo.fin) return safeReply(interaction, { content: '⏰ Este sorteo ya terminó.' });
    if (sorteo.estado !== 'activo') return safeReply(interaction, { content: '⚠️ Este sorteo no está activo.' });
    const yaParticipa = sorteo.participantes?.find(p => p.userId === interaction.user.id);
    if (yaParticipa) return safeReply(interaction, { content: `${E.check} Ya estás participando con **${yaParticipa.entradas}** entrada(s). ¡Buena suerte!` });
    const miembro = interaction.member;
    const vipRoleId = data.config?.vipRoleId ?? null;
    const entradas = sorteoEntradas(data, interaction.user.id, miembro, vipRoleId);
    const esVip = esClienteVip(miembro, vipRoleId);
    if (!sorteo.participantes) sorteo.participantes = [];
    sorteo.participantes.push({ userId: interaction.user.id, userTag: interaction.user.tag, entradas });
    saveData(interaction.guild.id, data);
    try {
        const rowSorteo = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`sorteo_participar_${sorteoId}`).setLabel('🎟️ Participar').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`sorteo_finalizar_${sorteoId}`).setLabel('🏆 Finalizar').setStyle(ButtonStyle.Secondary)
        );
        await interaction.message.edit({ embeds: [buildSorteoEmbed(sorteo, interaction.guild.name)], components: [rowSorteo] }).catch(() => {});
    } catch { /* no crítico */ }
    return safeReply(interaction, { content: `🎟️ ¡Participas con **${entradas}** entrada(s)!${esVip ? `\n> ${E.diamante} **Bonus VIP:** Doble entradas aplicadas.` : `\n${E.line} *Más compras = más entradas (máx. 10)*`}` });
}

async function handleSorteoFinalizar(interaction, sorteoId) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator))
        return safeReply(interaction, { content: '🚫 Solo administradores pueden finalizar sorteos.' });
    const data = loadData(interaction.guild.id);
    if (!data.sorteos) data.sorteos = [];
    const sorteo = data.sorteos.find(s => s.id === sorteoId);
    if (!sorteo) return safeReply(interaction, { content: '⚠️ Sorteo no encontrado.' });
    if (sorteo.estado === 'finalizado') return safeReply(interaction, { content: '⚠️ Este sorteo ya fue finalizado.' });
    sorteo.estado = 'finalizado'; sorteo.fin = Date.now();
    sorteo.ganadores = elegirGanadores(sorteo.participantes ?? [], sorteo.cantGanadores);
    saveData(interaction.guild.id, data);
    const rowFinalizado = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`sorteo_participar_${sorteoId}`).setLabel('🎟️ Participar').setStyle(ButtonStyle.Success).setDisabled(true),
        new ButtonBuilder().setCustomId(`sorteo_finalizar_${sorteoId}`).setLabel('✅ Finalizado').setStyle(ButtonStyle.Secondary).setDisabled(true)
    );
    await interaction.update({ embeds: [buildSorteoEmbed(sorteo, interaction.guild.name)], components: [rowFinalizado] }).catch(() => {});
    if (sorteo.ganadores.length > 0) {
        await interaction.channel.send({ content: `🎉 **¡Felicitaciones!** ${sorteo.ganadores.map(id => `<@${id}>`).join(', ')}\n${E.arrow} ¡Ganaste el sorteo de **${sorteo.premio}**! 🎁` }).catch(() => {});
    } else {
        await interaction.channel.send({ content: '😔 El sorteo terminó sin participantes suficientes.' }).catch(() => {});
    }
}

async function handleSorteo(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator))
        return safeReply(interaction, { content: '🚫 Solo administradores.' });
    const premio        = interaction.options.getString('premio');
    const duracionMin   = interaction.options.getInteger('duracion') ?? 60;
    const cantGanadores = interaction.options.getInteger('ganadores') ?? 1;
    const imagenUrl     = interaction.options.getString('imagen') ?? null;
    if (imagenUrl) { try { new URL(imagenUrl); } catch { return safeReply(interaction, { content: '⚠️ URL de imagen no válida.' }); } }
    const data = loadData(interaction.guild.id);
    if (!data.sorteos) data.sorteos = [];
    const sorteoId = `${interaction.guild.id}_${Date.now()}`;
    const fin = Date.now() + duracionMin * 60 * 1000;
    const sorteo = { id: sorteoId, premio, fin, cantGanadores, estado: 'activo', participantes: [], ganadores: [], canalId: interaction.channelId, timestamp: Date.now(), imagen: imagenUrl };
    data.sorteos.push(sorteo);
    data.sorteos = data.sorteos.filter(s => Date.now() - s.timestamp < 7 * 24 * 60 * 60 * 1000);
    saveData(interaction.guild.id, data);
    const rowSorteo = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`sorteo_participar_${sorteoId}`).setLabel('🎟️ Participar').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`sorteo_finalizar_${sorteoId}`).setLabel('🏆 Finalizar').setStyle(ButtonStyle.Secondary)
    );
    await interaction.reply({ embeds: [buildSorteoEmbed(sorteo, interaction.guild.name)], components: [rowSorteo] });
    setTimeout(async () => {
        const dataActual = loadData(interaction.guild.id);
        const sorteoActual = dataActual.sorteos?.find(s => s.id === sorteoId);
        if (!sorteoActual || sorteoActual.estado === 'finalizado') return;
        sorteoActual.estado = 'finalizado';
        sorteoActual.ganadores = elegirGanadores(sorteoActual.participantes ?? [], sorteoActual.cantGanadores);
        saveData(interaction.guild.id, dataActual);
        try {
            const msg = await interaction.fetchReply();
            const rowFinalizado = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`sorteo_participar_${sorteoId}`).setLabel('🎟️ Participar').setStyle(ButtonStyle.Success).setDisabled(true),
                new ButtonBuilder().setCustomId(`sorteo_finalizar_${sorteoId}`).setLabel('✅ Finalizado').setStyle(ButtonStyle.Secondary).setDisabled(true)
            );
            await msg.edit({ embeds: [buildSorteoEmbed(sorteoActual, interaction.guild.name)], components: [rowFinalizado] }).catch(() => {});
            if (sorteoActual.ganadores.length > 0) {
                await interaction.channel.send({ content: `🎉 **¡El sorteo terminó!** ${sorteoActual.ganadores.map(id => `<@${id}>`).join(', ')}\n${E.arrow} ¡Ganaste **${sorteoActual.premio}**! 🎁` }).catch(() => {});
            }
        } catch { /* canal eliminado */ }
    }, duracionMin * 60 * 1000);
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
    let enviados = 0, fallidos = 0;
    for (let i = 0; i < clienteIds.length; i += 5) {
        await Promise.all(clienteIds.slice(i, i + 5).map(async (id) => {
            try {
                const miembro = interaction.guild.members.cache.get(id) ?? await interaction.guild.members.fetch(id).catch(() => null);
                if (!miembro) { fallidos++; return; }
                (await enviarDM(miembro.user, embedNotif)) ? enviados++ : fallidos++;
            } catch { fallidos++; }
        }));
        if (i + 5 < clienteIds.length) await new Promise(r => setTimeout(r, 1000));
    }
    return interaction.editReply({ content: '', embeds: [new EmbedBuilder().setColor('#57F287').setTitle(`${E.bot}  Notificación enviada`)
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
    try {
        const clienteUser = await interaction.client.users.fetch(venta.clienteId).catch(() => null);
        if (clienteUser) {
            const ok = await enviarDM(clienteUser, embedFactura);
            return safeReply(interaction, { content: ok ? `${E.check} Factura enviada por DM a <@${venta.clienteId}>.` : `⚠️ No se pudo enviar el DM a <@${venta.clienteId}>. Tiene los DMs desactivados.` });
        }
    } catch { /* fallthrough */ }
    return safeReply(interaction, { content: '⚠️ No se encontró al usuario cliente.' });
}

async function handleServidorStats(interaction) {
    const ok = await safeDefer(interaction);
    if (!ok) return;
    const data  = loadData(interaction.guild.id);
    const tdata = loadTickets(interaction.guild.id);
    const ventasActivas = data.ventas.filter(v => v.estado !== 'cancelada');
    const clientesUnicos   = new Set(ventasActivas.map(v => v.clienteId)).size;
    const operadoresUnicos = new Set(ventasActivas.map(v => v.vendedorId)).size;
    const ticketsCerrados  = tdata.tickets.filter(t => t.estado === 'cerrado').length;
    const ticketsAbiertos  = tdata.tickets.filter(t => t.estado === 'abierto').length;
    const totalResenas = data.resenas?.length ?? 0;
    const promedioResenas = totalResenas > 0 ? (data.resenas.reduce((s, r) => s + r.estrellas, 0) / totalResenas).toFixed(1) : null;
    const topV = Object.entries(data.analytics.porVendedor ?? {}).sort((a, b) => b[1].ventas - a[1].ventas)[0];
    const topC = Object.entries(data.analytics.porCliente  ?? {}).sort((a, b) => b[1].compras - a[1].compras)[0];
    const hoy    = ventasPorRango(ventasActivas, 'hoy');
    const semana = ventasPorRango(ventasActivas, 'semana');
    const mes    = ventasPorRango(ventasActivas, 'mes');
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
            `${E.arrow} 🧑‍💼 **Clientes únicos:**   \`${clientesUnicos}\`\n` +
            `${E.arrow} 🤝 **Operadores activos:** \`${operadoresUnicos}\`\n` +
            `${E.arrow} ${E.ticket} **Tickets cerrados:**  \`${ticketsCerrados}\`\n` +
            `${E.arrow} 📂 **Tickets abiertos:**  \`${ticketsAbiertos}\`\n` +
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
    for (const guild of client.guilds.cache.values()) {
        try {
            const tdata = loadTickets(guild.id);
            if (!tdata.config.staffRoleId) continue;
            const ticketsAbiertos = tdata.tickets.filter(t => t.estado === 'abierto');
            let guardado = false;
            for (const ticket of ticketsAbiertos) {
                const ultimaActividad = ticket.ultimaActividad ?? ticket.timestamp;
                if (ahora - ultimaActividad >= LIMITE_MS && !ticket.recordatorioEnviado) {
                    try {
                        const canal = guild.channels.cache.get(ticket.channelId) ?? await guild.channels.fetch(ticket.channelId).catch(() => null);
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
                        });
                        ticket.recordatorioEnviado = true; guardado = true;
                    } catch (err) { console.warn(`⚠️ Recordatorio ticket #${ticket.id}:`, err?.message); }
                }
            }
            if (guardado) saveTickets(guild.id, tdata);
        } catch (err) { console.warn(`⚠️ [recordatorio] ${guild.name}:`, err?.message); }
    }
}

function actualizarActividadTicket(guildId, channelId) {
    try {
        const tdata = loadTickets(guildId);
        const ticket = tdata.tickets.find(t => t.channelId === channelId && t.estado === 'abierto');
        if (!ticket) return;
        ticket.ultimaActividad = Date.now(); ticket.recordatorioEnviado = false;
        saveTickets(guildId, tdata);
    } catch { /* no crítico */ }
}

// ─── Cliente Discord ──────────────────────────────────────────────────────────
const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers]
});
client.on('error', (err) => { if (err?.code === 10062) return; console.error('❌ [Client]', err?.message); });
client.once('clientReady', () => {
    console.log(`✅ Bot listo como ${client.user.tag}`);
    client.user.setActivity('Aurex • /help 💎', { type: 3 });
    setInterval(() => console.log(`💓 Keep-alive • ${new Date().toLocaleString('es-MX')} • ${client.ws.ping}ms`), 5 * 60 * 1000);
    setInterval(verificarRecordatorios, 5 * 60 * 1000);
});

// ─── Sistema AFK estilo Apollo ────────────────────────────────────────────────
// Guarda: motivo, timestamp, menciones[], mensajes recibidos mientras AFK
// Al volver: muestra resumen completo con todas las menciones y tiempo ausente
// Timeout configurable: si lleva más de 24h AFK se limpia automáticamente
const AFK_TIMEOUT_MS = 24 * 60 * 60 * 1000; // 24 horas

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;
    actualizarActividadTicket(message.guild.id, message.channel.id);

    const data = loadData(message.guild.id);

    // ── Limpiar AFKs expirados (>24h) ────────────────────────────────────
    const ahora = Date.now();
    let limpiado = false;
    for (const [uid, afkInfo] of Object.entries(data.afk ?? {})) {
        if (ahora - afkInfo.tiempo > AFK_TIMEOUT_MS) {
            delete data.afk[uid];
            limpiado = true;
        }
    }
    if (limpiado) saveData(message.guild.id, data);

    // ── Volver del AFK ────────────────────────────────────────────────────
    if (data.afk[message.author.id]) {
        const afkInfo = data.afk[message.author.id];
        const duracion = tiempoRelativo(Date.now() - afkInfo.tiempo);
        const menciones = afkInfo.menciones ?? [];
        delete data.afk[message.author.id];
        saveData(message.guild.id, data);

        // Intentar renombrar el nick si tiene el prefijo AFK
        try {
            const miembro = message.guild.members.cache.get(message.author.id);
            if (miembro && miembro.nickname?.startsWith('[AFK] ')) {
                const nickSinAfk = miembro.nickname.replace('[AFK] ', '');
                await miembro.setNickname(nickSinAfk === message.author.username ? null : nickSinAfk).catch(() => {});
            }
        } catch { /* sin permisos */ }

        let desc = `### 👋  ¡Bienvenido de vuelta, ${message.author.username}!\n\n` +
            `${E.arrow} ${E.reloj} Estuviste ausente **${duracion}**\n` +
            `${E.arrow} 📝 Motivo: *${afkInfo.motivo}*\n`;

        if (menciones.length > 0) {
            desc += `\n**${E.campana} Te mencionaron ${menciones.length} vez${menciones.length > 1 ? 'es' : ''}:**\n`;
            // Mostrar las últimas 10 menciones máximo
            const recientes = menciones.slice(-10);
            for (const m of recientes) {
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
                .setFooter({ text: `Aurex • AFK finalizado` })
                .setTimestamp()]
        }).catch(() => {});
        return;
    }

    // ── Registrar mención a usuarios AFK ─────────────────────────────────
    if (message.mentions.users.size > 0) {
        let modificado = false;
        for (const [, usuario] of message.mentions.users) {
            if (!data.afk[usuario.id] || message.author.id === usuario.id) continue;
            const afkInfo = data.afk[usuario.id];
            if (!afkInfo.menciones) afkInfo.menciones = [];

            // Guardar datos ricos de la mención
            afkInfo.menciones.push({
                tag:       message.author.tag,
                userId:    message.author.id,
                url:       message.url,
                channelId: message.channel.id,
                timestamp: Date.now(),
                contenido: message.content.replace(/<@!?\d+>/g, '').trim() || null
            });
            modificado = true;

            const durAFK = tiempoRelativo(Date.now() - afkInfo.tiempo);
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

    // ── Mención al bot ────────────────────────────────────────────────────
    if (message.mentions.has(client.user)) {
        await message.reply({
            embeds: [new EmbedBuilder()
                .setColor('#5865F2')
                .setDescription(`### ${E.bot}  ¡Hola!\n\n${E.arrow} Usa \`/help\` para ver todos mis comandos.`)]
        }).catch(() => {});
        return;
    }

    // ── Prefijo de texto ──────────────────────────────────────────────────
    if (!message.content.startsWith(PREFIX)) return;
    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const cmd  = args.shift().toLowerCase();
    if (cmd === 'ping') return message.reply(`🏓 Pong! \`${Math.round(client.ws.ping)}ms\``).catch(() => {});
});

// ─── Interactions ─────────────────────────────────────────────────────────────
client.on('interactionCreate', async (interaction) => {
    // ── Tickets ───────────────────────────────────────────────────────────
    if (
        (interaction.isStringSelectMenu() && interaction.customId === 'ticket_categoria') ||
        (interaction.isModalSubmit()      && interaction.customId.startsWith('ticket_modal_')) ||
        (interaction.isButton()           && interaction.customId.startsWith('ticket_cerrar_'))
    ) return safeHandle(interaction, () => handleTicketInteraction(interaction));

    // ── Stock bulk ────────────────────────────────────────────────────────
    if (interaction.isModalSubmit() && interaction.customId === 'stock_bulk_modal')
        return safeHandle(interaction, () => handleStockBulkModal(interaction));

    // ── Sorteos ───────────────────────────────────────────────────────────
    if (interaction.isButton() && interaction.customId.startsWith('sorteo_participar_'))
        return safeHandle(interaction, () => handleSorteoParticipar(interaction, interaction.customId.replace('sorteo_participar_', '')));

    if (interaction.isButton() && interaction.customId.startsWith('sorteo_finalizar_'))
        return safeHandle(interaction, () => handleSorteoFinalizar(interaction, interaction.customId.replace('sorteo_finalizar_', '')));

    // ── Help ──────────────────────────────────────────────────────────────
    if (interaction.isButton() && interaction.customId.startsWith('help_')) {
        return safeHandle(interaction, async () => {
            const key = interaction.customId.replace('help_cat_', '').replace('help_', '');
            if (key === 'inicio') return interaction.update({ embeds: [buildHelpInicio(interaction.guild)], components: buildHelpRows() });
            const cat = HELP_CATEGORIAS[key];
            if (!cat) return;
            return interaction.update({ embeds: [cat.embed()], components: buildHelpRows() });
        });
    }

    // ── Cancelar orden ────────────────────────────────────────────────────
    if (interaction.isButton() && interaction.customId.startsWith('cancelar_confirm_')) {
        return safeHandle(interaction, async () => {
            const ordenId = parseInt(interaction.customId.split('_')[2]);
            const data = loadData(interaction.guild.id);
            const venta = data.ventas.find(v => v.id === ordenId);
            if (!venta || venta.estado === 'cancelada') return interaction.update({ content: '⚠️ Esta orden ya fue procesada.', components: [] });
            venta.estado = 'cancelada';
            data.analytics.totalVentas = Math.max(0, data.analytics.totalVentas - 1);
            data.analytics.totalRobux  = Math.max(0, data.analytics.totalRobux - venta.robux);
            if (data.analytics.porVendedor[venta.vendedorId]) { data.analytics.porVendedor[venta.vendedorId].ventas--; data.analytics.porVendedor[venta.vendedorId].robux -= venta.robux; }
            if (data.analytics.porCliente?.[venta.clienteId]) { data.analytics.porCliente[venta.clienteId].compras--; data.analytics.porCliente[venta.clienteId].robux -= venta.robux; }
            saveData(interaction.guild.id, data);
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
        return interaction.update({ content: '✅ Cancelación abortada.', components: [] }).catch(() => {});

    // ── Reseña (botón) ────────────────────────────────────────────────────
    if (interaction.isButton() && interaction.customId.startsWith('reseña_')) {
        return safeHandle(interaction, async () => {
            const ordenId = parseInt(interaction.customId.split('_')[1]);
            const data = loadData(interaction.guild.id);
            const venta = data.ventas.find(v => v.id === ordenId);
            if (!venta || interaction.user.id !== venta.clienteId) return safeReply(interaction, { content: '⚠️ Solo el cliente puede dejar reseña.' });
            if (data.resenas.find(r => r.ordenId === ordenId)) return safeReply(interaction, { content: '⚠️ Ya dejaste una reseña para esta orden.' });
            const modal = new ModalBuilder().setCustomId(`modal_resena_${ordenId}`).setTitle(`⭐ Reseña — Orden #${ordenId}`);
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('estrellas').setLabel('Calificación (1 a 5 ⭐)').setPlaceholder('Número del 1 al 5').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(1)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('comentario').setLabel('Comentario (opcional)').setStyle(TextInputStyle.Paragraph).setRequired(false).setMaxLength(300).setPlaceholder('Cuéntanos tu experiencia...')),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('imagen_url').setLabel('URL de imagen / prueba (opcional)').setStyle(TextInputStyle.Short).setRequired(false).setPlaceholder('https://imgur.com/...'))
            );
            return interaction.showModal(modal);
        });
    }

    // ── Reseña (modal submit) ─────────────────────────────────────────────
    if (interaction.isModalSubmit() && interaction.customId.startsWith('modal_resena_')) {
        return safeHandle(interaction, async () => {
            const ordenId      = parseInt(interaction.customId.split('_')[2]);
            const data         = loadData(interaction.guild.id);
            const venta        = data.ventas.find(v => v.id === ordenId);
            const numEstrellas = parseInt(interaction.fields.getTextInputValue('estrellas'));
            const comentario   = interaction.fields.getTextInputValue('comentario') || null;
            const imagenUrl    = interaction.fields.getTextInputValue('imagen_url') || null;
            if (isNaN(numEstrellas) || numEstrellas < 1 || numEstrellas > 5)
                return safeReply(interaction, { content: '⚠️ Calificación del 1 al 5.' });
            let imagenValida = null;
            if (imagenUrl) { try { new URL(imagenUrl); imagenValida = imagenUrl; } catch { /* ignorar */ } }
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

    // ─── Slash commands ───────────────────────────────────────────────────
    safeHandle(interaction, async () => {
        const data  = loadData(interaction.guild.id);
        const guild = interaction.guild;
        const user  = interaction.user;

        if (interaction.commandName === 'help')
            return interaction.reply({ embeds: [buildHelpInicio(guild)], components: buildHelpRows(), flags: 64 });
        if (interaction.commandName === 'ping')
            return safeReply(interaction, { content: `🏓 Pong! \`${Math.round(client.ws.ping)}ms\`` });
        if (interaction.commandName === 'ticket-setup') return handleTicketSetup(interaction);
        if (interaction.commandName === 'sorteo')        return handleSorteo(interaction);
        if (interaction.commandName === 'notificar')     return handleNotificar(interaction);
        if (interaction.commandName === 'factura')       return handleFactura(interaction);
        if (interaction.commandName === 'servidor-stats') return handleServidorStats(interaction);

        if (interaction.commandName === 'setvip') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator))
                return safeReply(interaction, { content: '🚫 Solo administradores.' });
            const rol = interaction.options.getRole('rol');
            data.config.vipRoleId = rol.id;
            saveData(guild.id, data);
            return safeReply(interaction, { content: '', embeds: [new EmbedBuilder().setColor('#FEE75C')
                .setTitle(`${E.roles}  Rol VIP configurado`)
                .setDescription(`${E.arrow} ${E.diamante} **Rol VIP:** <@&${rol.id}>\n${E.arrow} 🎟️ Los miembros con este rol tendrán **doble entrada** en sorteos.`)
                .setTimestamp()] });
        }

        if (interaction.commandName === 'settiers') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) return safeReply(interaction, { content: '🚫 Solo administradores.' });
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
            return safeReply(interaction, { content: '', embeds: [new EmbedBuilder().setColor('#FEE75C').setTitle(`${E.roles}  Tiers de compras`)
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
            const n = data.ventas.length + 1;
            const venta = { id: n, producto, clienteId: clienteU.id, clienteTag: clienteU.tag, vendedorId: vendedor.id, vendedorTag: vendedor.tag, robux, precio: precio ?? 'No especificado', metodo, timestamp: Date.now(), estado: 'completada' };
            data.ventas.push(venta);
            data.analytics.totalVentas++;
            data.analytics.totalRobux += robux;
            if (!data.analytics.porVendedor[vendedor.id]) data.analytics.porVendedor[vendedor.id] = { ventas: 0, robux: 0, tag: vendedor.tag };
            data.analytics.porVendedor[vendedor.id].ventas++;
            data.analytics.porVendedor[vendedor.id].robux += robux;
            if (!data.analytics.porCliente) data.analytics.porCliente = {};
            if (!data.analytics.porCliente[clienteU.id]) data.analytics.porCliente[clienteU.id] = { compras: 0, robux: 0, tag: clienteU.tag };
            data.analytics.porCliente[clienteU.id].compras++;
            data.analytics.porCliente[clienteU.id].robux += robux;
            saveData(guild.id, data);
            await actualizarTier(guild, clienteU.id, data.analytics.porCliente[clienteU.id].compras, data.config.tierRoles);
            const rowResena = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`reseña_${n}`).setLabel('⭐ Dejar reseña').setStyle(ButtonStyle.Secondary));
            await interaction.reply({ embeds: [buildVentaPublicaEmbed(venta, n)], components: [rowResena] });
            if (data.config.dmEnabled) await enviarDM(clienteU, buildDMVentaEmbed(venta, n, guild.name, guild.iconURL({ dynamic: true })));
            if (data.config.logChannelId) { const lc = guild.channels.cache.get(data.config.logChannelId); if (lc) await lc.send({ embeds: [buildLogEmbed(venta, n)] }).catch(() => {}); }
            if (data.analytics.totalVentas % 10 === 0) await interaction.followUp({ embeds: [new EmbedBuilder().setColor('#FEE75C').setTitle('🏆  ¡Hito alcanzado!').setDescription(`${E.arrow} **${guild.name}** alcanzó **${data.analytics.totalVentas}** pedidos.\n${E.arrow} ${E.money} Total: \`${formatRobux(data.analytics.totalRobux)}\``)] }).catch(() => {});
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
            return safeReply(interaction, { content: '', embeds: [embedOrden] });
        }

        if (interaction.commandName === 'buscar') {
            const objetivo = interaction.options.getUser('cliente');
            const ventas = data.ventas.filter(v => v.clienteId === objetivo.id && v.estado !== 'cancelada');
            if (ventas.length === 0) return safeReply(interaction, { content: `📭 **${objetivo.username}** no tiene pedidos.` });
            const ultimas = ventas.slice(-8).reverse();
            const resenas = data.resenas?.filter(r => r.clienteId === objetivo.id) ?? [];
            const promedio = resenas.length > 0 ? (resenas.reduce((s, r) => s + r.estrellas, 0) / resenas.length).toFixed(1) : null;
            const tierCliente = getTier(data.analytics.porCliente?.[objetivo.id]?.compras ?? 0);
            return safeReply(interaction, { content: '', embeds: [new EmbedBuilder().setColor('#5865F2').setTitle(`👤  Historial de ${objetivo.username}`).setThumbnail(objetivo.displayAvatarURL({ dynamic: true }))
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
            return safeReply(interaction, { content: '', embeds: [new EmbedBuilder().setColor('#5865F2').setTitle(`${E.orders}  Historial — ${guild.name}`)
                .setDescription(
                    ultimas.map(v => { const t = v.estado === 'cancelada' ? '~~' : ''; return `${E.line} \`#${v.id}\` ${t}**${v.producto}**${t} — \`${formatRobux(v.robux)}\` — <@${v.clienteId}>`; }).join('\n') +
                    `\n\n${E.arrow} 🧾 **Total:** \`${ventas.length}\`\n${E.arrow} ${E.money} **R$ movidos:** \`${formatRobux(ventas.reduce((s, v) => s + v.robux, 0))}\``
                ).setFooter({ text: `Últimos ${ultimas.length} de ${ventas.length}` }).setTimestamp()] });
        }

        if (interaction.commandName === 'reseña') {
            const ordenId = interaction.options.getInteger('orden');
            const venta = data.ventas.find(v => v.id === ordenId);
            if (!venta) return safeReply(interaction, { content: `⚠️ No existe la orden \`#${ordenId}\`.` });
            if (venta.clienteId !== user.id) return safeReply(interaction, { content: '⚠️ Solo el cliente puede dejar reseña.' });
            if (data.resenas?.find(r => r.ordenId === ordenId)) return safeReply(interaction, { content: '⚠️ Ya dejaste una reseña.' });
            const modal = new ModalBuilder().setCustomId(`modal_resena_${ordenId}`).setTitle(`⭐ Reseña — Orden #${ordenId}`);
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('estrellas').setLabel('Calificación (1 a 5 ⭐)').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(1).setPlaceholder('Número del 1 al 5')),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('comentario').setLabel('Comentario (opcional)').setStyle(TextInputStyle.Paragraph).setRequired(false).setMaxLength(300).setPlaceholder('Cuéntanos tu experiencia...')),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('imagen_url').setLabel('URL de imagen / prueba (opcional)').setStyle(TextInputStyle.Short).setRequired(false).setPlaceholder('https://imgur.com/...')))
            ;
            return interaction.showModal(modal);
        }

        if (interaction.commandName === 'resenas') {
            const objetivo = interaction.options.getUser('vendedor');
            const resenas  = data.resenas?.filter(r => r.vendedorId === objetivo.id) ?? [];
            if (resenas.length === 0) return safeReply(interaction, { content: `📭 **${objetivo.username}** no tiene reseñas.` });
            const promedio = (resenas.reduce((s, r) => s + r.estrellas, 0) / resenas.length).toFixed(1);
            return safeReply(interaction, { content: '', embeds: [new EmbedBuilder().setColor('#FEE75C').setTitle(`${E.review}  Reseñas de ${objetivo.username}`).setThumbnail(objetivo.displayAvatarURL({ dynamic: true }))
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
            if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) return safeReply(interaction, { content: '🚫 Necesitas **Gestionar mensajes**.' });
            const ordenId = interaction.options.getInteger('orden');
            const venta   = data.ventas.find(v => v.id === ordenId);
            if (!venta) return safeReply(interaction, { content: `⚠️ No existe la orden \`#${ordenId}\`.` });
            if (venta.estado === 'cancelada') return safeReply(interaction, { content: '⚠️ Ya está cancelada.' });
            return safeReply(interaction, { content: '', embeds: [new EmbedBuilder().setColor('#ED4245').setTitle(`⚠️  ¿Cancelar orden \`#${ordenId}\`?`)
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
            if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) return safeReply(interaction, { content: '🚫 Necesitas **Gestionar mensajes**.' });
            const rango  = interaction.options.getString('rango') ?? 'mes';
            const ventas = ventasPorRango(data.ventas, rango).filter(v => v.estado !== 'cancelada');
            if (ventas.length === 0) return safeReply(interaction, { content: '📭 No hay pedidos en ese período.' });
            const etiquetas = { hoy: 'Hoy', semana: 'Esta semana', mes: 'Este mes' };
            const totalRobux = ventas.reduce((s, v) => s + v.robux, 0);
            let texto = `REPORTE — ${etiquetas[rango]}\nServidor: ${guild.name}\nGenerado: ${new Date().toLocaleString('es-MX')}\n${'─'.repeat(60)}\n\n`;
            ventas.forEach(v => { texto += `#${v.id} | ${v.producto} | ${formatRobux(v.robux)} | ${v.precio} | ${v.metodo} | Cliente: ${v.clienteTag} | Operador: ${v.vendedorTag}\n`; });
            texto += `\n${'─'.repeat(60)}\nTOTAL: ${ventas.length} pedidos | ${formatRobux(totalRobux)}\n`;
            return interaction.reply({ content: `${E.export} **${ventas.length}** pedidos exportados:`, files: [{ attachment: Buffer.from(texto, 'utf8'), name: `pedidos-${rango}.txt` }], flags: 64 });
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
            return safeReply(interaction, { content: '', embeds: [new EmbedBuilder().setColor('#5865F2').setTitle(`👤  ${objetivo.username}${esVip ? `  ${E.diamante} VIP` : ''}`).setThumbnail(objetivo.displayAvatarURL({ dynamic: true }))
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
            return safeReply(interaction, { content: '', embeds: [new EmbedBuilder().setColor('#FEE75C').setTitle(`${E.stats}  Stats — ${etiquetas[rango]}`)
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
                const lista = Object.entries(data.analytics.porCliente ?? {}).map(([id, d]) => ({ id, ...d })).filter(c => c.compras > 0).sort((a, b) => por === 'robux' ? b.robux - a.robux : b.compras - a.compras).slice(0, 10);
                if (lista.length === 0) return safeReply(interaction, { content: '📭 Sin compras aún.' });
                return safeReply(interaction, { content: '', embeds: [new EmbedBuilder().setColor('#FEE75C').setTitle(`${E.corona}  Top compradores`).setDescription(lista.map((c, i) => `> ${medallas[i] ?? `**${i + 1}.**`} <@${c.id}> — \`${c.compras}\` compra(s) • \`${formatRobux(c.robux)}\``).join('\n')).setTimestamp()] });
            }
            const lista = Object.entries(data.analytics.porVendedor).map(([id, d]) => ({ id, ...d })).filter(v => v.ventas > 0).sort((a, b) => por === 'robux' ? b.robux - a.robux : b.ventas - a.ventas).slice(0, 10);
            if (lista.length === 0) return safeReply(interaction, { content: '📭 Sin pedidos aún.' });
            return safeReply(interaction, { content: '', embeds: [new EmbedBuilder().setColor('#57F287').setTitle('🏆  Top operadores').setDescription(lista.map((v, i) => `> ${medallas[i] ?? `**${i + 1}.**`} <@${v.id}> — \`${v.ventas}\` pedido(s) • \`${formatRobux(v.robux)}\``).join('\n')).setTimestamp()] });
        }

        if (interaction.commandName === 'dashboard') {
            const hoy    = ventasPorRango(data.ventas, 'hoy').filter(v => v.estado !== 'cancelada');
            const semana = ventasPorRango(data.ventas, 'semana').filter(v => v.estado !== 'cancelada');
            const mes    = ventasPorRango(data.ventas, 'mes').filter(v => v.estado !== 'cancelada');
            const topV   = Object.entries(data.analytics.porVendedor).sort((a, b) => b[1].ventas - a[1].ventas)[0];
            const topC   = data.analytics.porCliente ? Object.entries(data.analytics.porCliente).sort((a, b) => b[1].compras - a[1].compras)[0] : null;
            const totalR = data.resenas?.length ?? 0;
            const prom   = totalR > 0 ? (data.resenas.reduce((s, r) => s + r.estrellas, 0) / totalR).toFixed(1) : null;
            return safeReply(interaction, { content: '', embeds: [new EmbedBuilder().setColor('#5865F2').setTitle(`${E.analytics}  Dashboard — ${guild.name}`).setThumbnail(guild.iconURL({ dynamic: true }) ?? null)
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

        // ── /afk mejorado (estilo Apollo) ─────────────────────────────────
        if (interaction.commandName === 'afk') {
            const motivo = interaction.options.getString('motivo') ?? 'Sin motivo';

            // Si ya estaba en AFK, cancelarlo
            if (data.afk[user.id]) {
                const anterior = data.afk[user.id];
                delete data.afk[user.id];
                saveData(guild.id, data);
                return safeReply(interaction, { content: '', embeds: [new EmbedBuilder()
                    .setColor('#FEE75C')
                    .setDescription(`### ${E.advertencia}  AFK cancelado\n\n${E.arrow} Tu AFK anterior (*${anterior.motivo}*) fue removido.\n${E.arrow} Ahora tu nuevo AFK está activo: *${motivo}*`)
                    .setTimestamp()] });
            }

            data.afk[user.id] = { motivo, tiempo: Date.now(), menciones: [] };
            saveData(guild.id, data);

            // Intentar poner prefijo [AFK] en el nick
            try {
                const miembro = guild.members.cache.get(user.id);
                if (miembro && guild.members.me.permissions.has(PermissionFlagsBits.ManageNicknames)) {
                    const nickActual = miembro.nickname ?? miembro.user.username;
                    if (!nickActual.startsWith('[AFK] ')) {
                        await miembro.setNickname(`[AFK] ${nickActual}`.slice(0, 32)).catch(() => {});
                    }
                }
            } catch { /* sin permisos, no crítico */ }

            return safeReply(interaction, { content: '', embeds: [new EmbedBuilder()
                .setColor('#3498DB')
                .setTitle(`💤  AFK activado`)
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
            if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) return safeReply(interaction, { content: '🚫 Necesitas **Gestionar mensajes**.' });
            const imagenUrl = interaction.options.getString('imagen') ?? null;
            const embed = new EmbedBuilder().setColor('#ED4245').setTitle(`📢  ${interaction.options.getString('titulo')}`).setDescription(interaction.options.getString('mensaje')).setFooter({ text: `Anuncio por ${user.tag} · Aurex` }).setTimestamp();
            if (imagenUrl) { try { new URL(imagenUrl); embed.setImage(imagenUrl); } catch {} }
            const opts = { embeds: [embed] };
            const textoBoton = interaction.options.getString('texto_boton'); const enlaceBoton = interaction.options.getString('enlace_boton');
            if (textoBoton && enlaceBoton) opts.components = [new ActionRowBuilder().addComponents(new ButtonBuilder().setLabel(textoBoton).setURL(enlaceBoton).setStyle(ButtonStyle.Link))];
            await safeReply(interaction, { content: '✅ Anuncio enviado.' });
            return interaction.channel.send(opts).catch(() => {});
        }

        if (interaction.commandName === 'clear') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) return safeReply(interaction, { content: '🚫 Necesitas **Gestionar mensajes**.' });
            const cantidad = interaction.options.getInteger('cantidad');
            if (cantidad < 1 || cantidad > 100) return safeReply(interaction, { content: '⚠️ Entre 1 y 100.' });
            const deleted = await interaction.channel.bulkDelete(cantidad, true).catch(() => null);
            return safeReply(interaction, { content: `🗑️ **${deleted?.size ?? 0}** mensaje(s) eliminados.` });
        }

        if (interaction.commandName === 'setlog') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) return safeReply(interaction, { content: '🚫 Solo administradores.' });
            data.config.logChannelId = interaction.options.getChannel('canal').id;
            saveData(guild.id, data);
            return safeReply(interaction, { content: `${E.settings} Canal de logs: <#${data.config.logChannelId}>` });
        }

        if (interaction.commandName === 'setresenas') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) return safeReply(interaction, { content: '🚫 Solo administradores.' });
            data.config.resenaChannelId = interaction.options.getChannel('canal').id;
            saveData(guild.id, data);
            return safeReply(interaction, { content: `${E.settings} Canal de reseñas: <#${data.config.resenaChannelId}>` });
        }

        if (interaction.commandName === 'configdm') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) return safeReply(interaction, { content: '🚫 Solo administradores.' });
            data.config.dmEnabled = interaction.options.getBoolean('estado');
            saveData(guild.id, data);
            return safeReply(interaction, { content: `${E.settings} DMs: **${data.config.dmEnabled ? 'activados ✅' : 'desactivados ❌'}**` });
        }

        if (interaction.commandName === 'setdm') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) return safeReply(interaction, { content: '🚫 Solo administradores.' });
            const texto = interaction.options.getString('texto');
            data.config.dmCierreTexto = texto;
            saveData(guild.id, data);
            return safeReply(interaction, { content: '', embeds: [new EmbedBuilder().setColor('#57F287').setTitle(`${E.settings}  Mensaje de cierre actualizado`).setDescription(`${E.line} ${texto.replace(/\n/g, `\n${E.line} `)}\n\n*Variables: \`{usuario}\` \`{servidor}\`*`)] });
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
            return safeReply(interaction, { content: '', embeds: [new EmbedBuilder().setColor('#5865F2').setTitle(`${E.stock}  Stock disponible`).setDescription(lineas).setFooter({ text: `${stock.length} ítem(s) • ${guild.name} · Aurex` }).setTimestamp()] });
        }

        if (interaction.commandName === 'stock-admin') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) return safeReply(interaction, { content: '🚫 Solo administradores.' });
            const accion   = interaction.options.getString('accion');
            const nombre   = interaction.options.getString('nombre');
            const cantidad = interaction.options.getInteger('cantidad');
            const precio   = interaction.options.getString('precio');
            const notas    = interaction.options.getString('notas');
            if (!data.stock) data.stock = [];
            if (accion === 'agregar') {
                data.stock.push({ nombre, cantidad: cantidad ?? 0, precio: precio ?? null, notas: notas ?? null });
                saveData(guild.id, data);
                return safeReply(interaction, { content: '', embeds: [new EmbedBuilder().setColor('#57F287').setTitle(`${E.stock}  Ítem agregado`).setDescription(`${E.arrow} ${E.caja} **${nombre}** — \`${cantidad ?? 0}\` unidades — \`${precio ?? 'Sin precio'}\``)] });
            }
            if (accion === 'editar') {
                const idx = data.stock.findIndex(i => i.nombre.toLowerCase() === nombre?.toLowerCase());
                if (idx === -1) return safeReply(interaction, { content: `⚠️ No existe \`${nombre}\`.` });
                if (cantidad !== null) data.stock[idx].cantidad = cantidad;
                if (precio  !== null) data.stock[idx].precio   = precio;
                if (notas   !== null) data.stock[idx].notas    = notas;
                saveData(guild.id, data);
                return safeReply(interaction, { content: `${E.check} \`${data.stock[idx].nombre}\` actualizado.` });
            }
            if (accion === 'eliminar') {
                const idx = data.stock.findIndex(i => i.nombre.toLowerCase() === nombre?.toLowerCase());
                if (idx === -1) return safeReply(interaction, { content: `⚠️ No existe \`${nombre}\`.` });
                data.stock.splice(idx, 1);
                saveData(guild.id, data);
                return safeReply(interaction, { content: `🗑️ **${nombre}** eliminado.` });
            }
            if (accion === 'limpiar') {
                data.stock = [];
                saveData(guild.id, data);
                return safeReply(interaction, { content: '🗑️ Stock limpiado.' });
            }
        }

        if (interaction.commandName === 'stock-bulk') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) return safeReply(interaction, { content: '🚫 Solo administradores.' });
            const modal = new ModalBuilder().setCustomId('stock_bulk_modal').setTitle(`${E.caja} Carga masiva de stock`);
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('items_texto').setLabel('Ítems — uno por línea').setStyle(TextInputStyle.Paragraph)
                    .setPlaceholder('Nombre | cantidad | precio | notas\n\nEjemplos:\nRobux 1000 | 10 | $5 USD | Entrega inmediata\nCuenta Premium | 3 | $15 USD').setRequired(true).setMaxLength(3000)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('modo_valor').setLabel('Modo: "agregar" o "reemplazar"').setStyle(TextInputStyle.Short)
                    .setPlaceholder('agregar').setRequired(false).setMaxLength(10))
            );
            return interaction.showModal(modal);
        }
    });
});

client.login(process.env.TOKEN);