const {
    Client, GatewayIntentBits, EmbedBuilder, PermissionFlagsBits,
    ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder,
    TextInputBuilder, TextInputStyle, StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder, ChannelType
} = require('discord.js');
const fs   = require('fs');
const path = require('path');
require('dotenv').config();

// ─── Servidores autorizados ───────────────────────────────────────────────────
const ALLOWED_GUILDS = (process.env.ALLOWED_GUILDS ?? '').split(',').map(s => s.trim()).filter(Boolean);

if (!process.env.TOKEN) {
    console.error('❌ FATAL: La variable de entorno TOKEN no está configurada.');
    process.exit(1);
}

const BANNER_URL = 'https://i.imgur.com/RHLSmgM.png';

// ─── Emojis externos ──────────────────────────────────────────────────────────
const EX = {
    gifr:      '<:Gifr:1514442443209052281>',
    flecha:    '<a:Flecha:1513677979950252193>',
    warning:   '<:Warning:1513678086204293120>',
    alert:     '<a:Alert:1513678401746239520>',
    dinero:    '<a:Dinero:1513678931402686585>',
    starr:     '<a:starr:1514437831668531310>',
    nochee:    '<a:nochee:1514438882987610165>',
    bluecrown: '<a:BlueCrownn:1514439987595055234>',
    carrito:   '<:CarritoCompras:1514442182042452038>',
    dinero2:   '<:Dinero2:1514469115492831343>',
    document:  '<a:document:1514443447443128391>',
    discordss: '<:discordss:1514444199175393370>',
    boost:     '<a:boost:1514445334947037214>',
    // bluestar: si el emoji no renderiza en tu servidor, cámbialo por '⭐'
    bluestar:  '<a:Bluestar:1514445439045210173>',
};

// ─── Emojis internos ──────────────────────────────────────────────────────────
const E = {
    reloj:       '<:Aurex_Reloj:1513372785727111278>',
    cerebro:     '<:Aurex_AiCerebro:1513372643728949278>',
    invoice:     '<:Aurex_Invoicemalhechoxd:1513372495695183872>',
    export:      '<:Aurex_Export:1513372369849290782>',
    settings:    '<:Aurex_Settings:1513371533161005177>',
    roles:       '<:Aurex_Roles:1513371413254508675>',
    orders:      '<:Aurex_Orders:1513363677569486999>',
    analytics:   '<:Aurex_Analytics:1513363579703787621>',
    review:      '<:Aurex_Review:1513362468133535764>',
    stats:       '<:Aurex_Stats:1513362232275243112>',
    bot:         '<:Aurex_Bot:1513350718248058991>',
    money:       '<:Aurex_Money:1513350564094804032>',
    ticket:      '<:Aurex_Ticket:1513350401850871819>',
    tarjeta:     '💳',
    keycard:     '🪪',
    caja:        '📦',
    diamante:    '💎',
    corona:      '👑',
    escudo:      '🛡️',
    campana:     '🔔',
    relojArena:  '⏳',
    check:       '✅',
    cruz:        '❌',
    advertencia: '⚠️',
    arrow:       '╰➤',
    arrowR:      '➜',
    dot:         '◆',
    line:        '▸',
    lock:        '🔒',
    unlock:      '🔓',
    hand:        '🤝',
    star:        '⭐',
    pin:         '📌',
    scroll:      '📜',
    person:      '👤',
    tools:       '🔧',
    gift:        '🎁',
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

function saveAtomic(filePath, data) {
    const tmp = filePath + '.tmp';
    try {
        fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
        try { fs.renameSync(tmp, filePath); }
        catch { fs.copyFileSync(tmp, filePath); try { fs.unlinkSync(tmp); } catch { } }
    } catch (e) {
        try { if (fs.existsSync(tmp)) fs.unlinkSync(tmp); } catch { }
        throw e;
    }
}

function _loadDataRaw(guildId) {
    const file = path.join(DATA_DIR, `${guildId}.json`);
    if (!fs.existsSync(file)) return _defaultData();
    try {
        const raw = fs.readFileSync(file, 'utf8');
        if (!raw || !raw.trim()) return _defaultData();
        return JSON.parse(raw);
    } catch (e) {
        console.error(`❌ loadData [${guildId}]:`, e.message);
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
        config: {
            logChannelId: null, dmEnabled: true, resenaChannelId: null,
            dmCierreTexto: null, tierRoles: {}, tierUmbrales: {},
            vipRoleId: null, vipCommandRoleId: null
        },
        afk: {},
        analytics: { totalVentas: 0, totalRobux: 0, porVendedor: {}, porCliente: {} },
        sorteos: [],
        vipMembers: {}
    };
}
function _defaultTickets() {
    return {
        tickets: [], cooldowns: {},
        config: {
            panelMessageId: null, panelChannelId: null, categoryId: null,
            logChannelId: null, vendedorRoleId: null, staffRoleId: null,
            panelImageUrl: null
        }
    };
}

function sanitizeData(data) {
    if (!data.ventas)                               data.ventas      = [];
    if (!data.resenas)                              data.resenas     = [];
    if (!data.afk)                                  data.afk         = {};
    if (!data.sorteos)                              data.sorteos     = [];
    if (!data.vipMembers)                           data.vipMembers  = {};
    if (!data.config)                               data.config      = {};
    if (data.config.logChannelId    === undefined)  data.config.logChannelId    = null;
    if (data.config.dmEnabled       === undefined)  data.config.dmEnabled       = true;
    if (data.config.resenaChannelId === undefined)  data.config.resenaChannelId = null;
    if (data.config.dmCierreTexto   === undefined)  data.config.dmCierreTexto   = null;
    if (!data.config.tierRoles)                     data.config.tierRoles       = {};
    if (!data.config.tierUmbrales)                  data.config.tierUmbrales    = {};
    if (data.config.vipRoleId        === undefined) data.config.vipRoleId       = null;
    if (data.config.vipCommandRoleId === undefined) data.config.vipCommandRoleId= null;
    if (!data.analytics)                            data.analytics   = {};
    if (!data.analytics.totalVentas)                data.analytics.totalVentas  = 0;
    if (!data.analytics.totalRobux)                 data.analytics.totalRobux   = 0;
    if (!data.analytics.porVendedor)                data.analytics.porVendedor  = {};
    if (!data.analytics.porCliente)                 data.analytics.porCliente   = {};
    return data;
}
function sanitizeTickets(data) {
    if (!data.tickets)   data.tickets   = [];
    if (!data.cooldowns) data.cooldowns = {};
    if (!data.config)    data.config    = {};
    const cfg = data.config;
    if (cfg.panelMessageId  === undefined) cfg.panelMessageId  = null;
    if (cfg.panelChannelId  === undefined) cfg.panelChannelId  = null;
    if (cfg.categoryId      === undefined) cfg.categoryId      = null;
    if (cfg.logChannelId    === undefined) cfg.logChannelId    = null;
    if (cfg.vendedorRoleId  === undefined) cfg.vendedorRoleId  = null;
    if (cfg.staffRoleId     === undefined) cfg.staffRoleId     = null;
    if (cfg.panelImageUrl   === undefined) cfg.panelImageUrl   = null;
    return data;
}
function loadData(guildId)    { return sanitizeData(_loadDataRaw(guildId));       }
function loadTickets(guildId) { return sanitizeTickets(_loadTicketsRaw(guildId)); }

// ─── Lock anti-doble ticket ───────────────────────────────────────────────────
const ticketLocks = new Set();

// ─── Manejo global de errores ─────────────────────────────────────────────────
function isIgnorableError(err) {
    if (!err) return true;
    const code = err.code ?? err.status;
    if ([10062, 40060, 10008, 10003, 50013, 50035, 40001, 40002].includes(code)) return true;
    const msg = (err.message ?? '').toLowerCase();
    if (msg.includes('unknown interaction'))       return true;
    if (msg.includes('unknown message'))           return true;
    if (msg.includes('cannot send messages'))      return true;
    if (msg.includes('missing access'))            return true;
    if (msg.includes('interaction has already been acknowledged')) return true;
    if (msg.includes('the user aborted a request')) return true;
    if (msg.includes('econnreset'))                return true;
    if (msg.includes('econnrefused'))              return true;
    if (msg.includes('etimedout'))                 return true;
    if (msg.includes('already been acknowledged')) return true;
    return false;
}
process.on('unhandledRejection', (err) => { if (!isIgnorableError(err)) console.error('❌ [unhandledRejection]', err?.message ?? err); });
process.on('uncaughtException',  (err) => { if (!isIgnorableError(err)) console.error('❌ [uncaughtException]',  err?.message ?? err); });
process.on('warning', (w) => { if (w.name !== 'MaxListenersExceededWarning') console.warn('⚠️', w.name, w.message); });

// ─── Helpers de interacción ───────────────────────────────────────────────────
async function safeReply(interaction, opts) {
    const o = { ...opts, flags: opts.flags ?? 64 };
    delete o.ephemeral;
    try {
        if (interaction.replied)  return await interaction.followUp(o);
        if (interaction.deferred) return await interaction.editReply(o);
        return await interaction.reply(o);
    } catch (e) { if (!isIgnorableError(e)) console.warn('⚠️ [safeReply]', e?.message); }
}
async function safeReplyPublic(interaction, opts) {
    try {
        if (interaction.replied)  return await interaction.followUp(opts);
        if (interaction.deferred) return await interaction.editReply(opts);
        return await interaction.reply(opts);
    } catch (e) { if (!isIgnorableError(e)) console.warn('⚠️ [safeReplyPublic]', e?.message); }
}
async function safeDefer(interaction, ephemeral = false) {
    if (interaction.deferred || interaction.replied) return true;
    try { await interaction.deferReply(ephemeral ? { flags: 64 } : {}); return true; }
    catch (e) { if (!isIgnorableError(e)) console.warn('⚠️ [safeDefer]', e?.message); return false; }
}
async function safeUpdate(interaction, opts) {
    try {
        if (interaction.replied || interaction.deferred) return await interaction.editReply(opts);
        return await interaction.update(opts);
    } catch (e) { if (!isIgnorableError(e)) console.warn('⚠️ safeUpdate:', e.message); }
}

// ─── FIX CRÍTICO: safeHandle corregido ───────────────────────────────────────
// No intenta responder si ya se respondió — evita el doble disparo
async function safeHandle(interaction, fn) {
    try {
        await fn();
    } catch (err) {
        if (isIgnorableError(err)) return;
        console.error(`❌ [safeHandle] ${interaction.commandName ?? interaction.customId ?? '?'}:`, err.message ?? err);
        try {
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: '⚠️ Ocurrió un error inesperado. Intenta de nuevo.', flags: 64 });
            } else if (interaction.deferred && !interaction.replied) {
                await interaction.editReply({ content: '⚠️ Ocurrió un error inesperado. Intenta de nuevo.' });
            }
            // Si ya respondió (replied = true), no hacer nada — la respuesta ya existe
        } catch { /* ignorar errores al intentar notificar el error */ }
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
    for (const [k, ts] of cooldownMap) if (ahora - ts > 300_000) cooldownMap.delete(k);
}, 10 * 60 * 1000);

// ─── Utilidades ───────────────────────────────────────────────────────────────
const PREFIX = '$';

function parseDuracion(str) {
    if (!str) return null;
    const s = String(str).trim().toLowerCase();
    const match = s.match(/^(\d+(?:\.\d+)?)(s|m|h|d)$/);
    if (!match) return null;
    const val = parseFloat(match[1]);
    const unit = match[2];
    const mul = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
    const ms = val * mul[unit];
    if (ms < 1000 || ms > 365 * 86_400_000) return null;
    return ms;
}
function formatDuracion(str) {
    const s = String(str).trim().toLowerCase();
    const match = s.match(/^(\d+(?:\.\d+)?)(s|m|h|d)$/);
    if (!match) return str;
    const labels = { s: 'segundo', m: 'minuto', h: 'hora', d: 'día' };
    const plural = parseFloat(match[1]) !== 1;
    return `${match[1]} ${labels[match[2]]}${plural ? 's' : ''}`;
}
function formatDuracionMs(ms) {
    const s = Math.floor(ms / 1000); const m = Math.floor(s / 60); const h = Math.floor(m / 60); const d = Math.floor(h / 24);
    if (d > 0) return `${d}d ${h % 24}h`;
    if (h > 0) return `${h}h ${m % 60}m`;
    if (m > 0) return `${m}m ${s % 60}s`;
    return `${s}s`;
}
function today() {
    return new Date().toLocaleString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function ventasPorRango(ventas, rango) {
    const ahora = Date.now();
    const rangos = { hoy: 86_400_000, semana: 604_800_000, mes: 2_592_000_000 };
    const limite = rangos[rango];
    if (!limite) return ventas;
    return ventas.filter(v => (ahora - v.timestamp) <= limite);
}
function tiempoRelativo(ms) { return formatDuracionMs(ms); }
function estrellas(n) { return '⭐'.repeat(Math.min(Math.max(n, 0), 5)); }
function calcDuracion(start, end) { return tiempoRelativo(end - start); }
function getTier(compras, umbralesCustom = {}) {
    const umbrales = [
        { nombre: 'bronce', min: umbralesCustom.bronce ?? 1,  emoji: '🥉', label: 'Bronce' },
        { nombre: 'plata',  min: umbralesCustom.plata  ?? 5,  emoji: '🥈', label: 'Plata'  },
        { nombre: 'oro',    min: umbralesCustom.oro    ?? 10, emoji: '🥇', label: 'Oro'    },
        { nombre: 'vip',    min: umbralesCustom.vip    ?? 20, emoji: '💎', label: 'VIP'    },
    ];
    let tier = null;
    for (const t of umbrales) { if (compras >= t.min) tier = t; }
    return tier;
}
function esClienteVip(miembro, vipRoleId) {
    if (!vipRoleId || !miembro) return false;
    return miembro.roles.cache.has(vipRoleId);
}
function nextVentaId(ventas) {
    return ventas.length ? ventas.reduce((max, v) => v.id > max ? v.id : max, 0) + 1 : 1;
}
function nextTicketId(tickets) {
    return tickets.length ? tickets.reduce((max, t) => t.id > max ? t.id : max, 0) + 1 : 1;
}
function withTimeout(promise, ms) {
    return Promise.race([promise, new Promise((_, r) => setTimeout(() => r(new Error('timeout')), ms))]);
}

// ─── Tier: asignar/quitar roles ───────────────────────────────────────────────
async function actualizarTier(guild, userId, comprasTotal, tierRoles, tierUmbrales = {}) {
    if (!tierRoles || Object.keys(tierRoles).length === 0) return;
    try {
        const miembro = guild.members.cache.get(userId) ?? await guild.members.fetch(userId).catch(() => null);
        if (!miembro) return;
        const tierActual = getTier(comprasTotal, tierUmbrales);
        const umbrales = [
            { nombre: 'bronce' }, { nombre: 'plata' }, { nombre: 'oro' }, { nombre: 'vip' }
        ];
        for (const t of umbrales) {
            const roleId = tierRoles[t.nombre];
            if (!roleId) continue;
            const debeTener = tierActual?.nombre === t.nombre;
            const laTiene   = miembro.roles.cache.has(roleId);
            if (debeTener && !laTiene) await miembro.roles.add(roleId).catch(() => {});
            else if (!debeTener && laTiene) await miembro.roles.remove(roleId).catch(() => {});
        }
    } catch (err) { console.warn('⚠️ No se pudo actualizar tier:', err?.message); }
}

async function enviarDM(user, embed, extra = {}) {
    try { await user.send({ embeds: [embed], ...extra }); return true; }
    catch { return false; }
}

// ─── Embeds de ventas ─────────────────────────────────────────────────────────
function buildLogEmbed(venta, n) {
    return new EmbedBuilder().setColor('#5865F2')
        .setTitle(`${EX.gifr}  Nueva orden registrada`)
        .setDescription(
            `${EX.flecha} **\`#${n}\`** — ${venta.producto}\n\n` +
            `${E.arrow} ${EX.dinero} **Monto:** \`${venta.monto ?? 'No especificado'}\`\n` +
            `${E.arrow} 💵 **Precio:** \`${venta.precio ?? 'No especificado'}\`\n` +
            `${E.arrow} ${E.tarjeta} **Método:** \`${venta.metodo}\`\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `${E.arrow} ${E.person} **Cliente:** <@${venta.clienteId}>\n` +
            `${E.arrow} ${E.hand} **Operador:** <@${venta.vendedorId}>`
        ).setFooter({ text: `${EX.bluestar} Bot • ${today()}` }).setTimestamp();
}
function buildDMVentaEmbed(venta, n, guildName, guildIconURL) {
    return new EmbedBuilder().setColor('#57F287')
        .setAuthor({ name: guildName, iconURL: guildIconURL ?? undefined })
        .setTitle(`${E.check}  ¡Pedido confirmado!`)
        .setThumbnail(guildIconURL ?? null)
        .setDescription(
            `¡Hola! Tu pedido fue procesado exitosamente 🎉\n\n` +
            `${E.arrow} ${E.caja} **Producto:** \`${venta.producto}\`\n` +
            `${E.arrow} ${EX.dinero} **Monto:** \`${venta.monto ?? 'No especificado'}\`\n` +
            `${E.arrow} 💵 **Precio:** \`${venta.precio ?? 'No especificado'}\`\n` +
            `${E.arrow} ${E.tarjeta} **Método:** \`${venta.metodo}\`\n` +
            `${E.arrow} ${E.orders} **Orden #:** \`${n}\`\n\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `*Guarda tu número de orden para cualquier consulta.*`
        ).setFooter({ text: `${guildName} · Bot` }).setTimestamp();
}
function buildVentaPublicaEmbed(venta, n) {
    return new EmbedBuilder().setColor('#5865F2')
        .setTitle(`${E.orders}  Orden \`#${n}\``)
        .setDescription(
            `${E.arrow} ${E.caja} **Producto:** \`${venta.producto}\`\n` +
            `${E.arrow} ${EX.dinero} **Monto:** \`${venta.monto ?? 'No especificado'}\`\n` +
            `${E.arrow} 💵 **Precio:** \`${venta.precio ?? 'No especificado'}\`\n` +
            `${E.arrow} ${E.tarjeta} **Método:** \`${venta.metodo}\`\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `${E.arrow} ${E.person} **Cliente:** <@${venta.clienteId}>\n` +
            `${E.arrow} ${E.hand} **Operador:** <@${venta.vendedorId}>`
        ).setFooter({ text: `${E.check} Registrado • ${today()}` }).setTimestamp();
}

// ─── Sistema de Help ──────────────────────────────────────────────────────────
const HELP_CATEGORIAS = {
    pedidos: {
        label: 'Pedidos',
        embed: () => new EmbedBuilder().setColor('#5865F2').setTitle(`${E.orders}  Pedidos`)
            .setDescription(
                `${EX.flecha} Comandos para registrar y gestionar ventas.\n\n` +
                `**\`/vender\`**\n${E.arrow} Registra una nueva venta.\n\n` +
                `**\`/orden [id]\`**\n${E.arrow} Detalle completo de una orden.\n\n` +
                `**\`/historial\`**\n${E.arrow} Lista los últimos pedidos.\n\n` +
                `**\`/buscar [cliente]\`**\n${E.arrow} Todos los pedidos de un cliente.\n\n` +
                `**\`/cancelar [orden]\`**\n${E.arrow} Cancela una orden con confirmación.\n\n` +
                `**\`/exportar\`**\n${E.arrow} Descarga un .txt con pedidos del período.\n\n` +
                `**\`/factura [orden]\`**\n${E.arrow} Envía comprobante por DM al cliente.`
            ).setFooter({ text: `Bot • /help • Pedidos` }).setTimestamp()
    },
    analiticas: {
        label: 'Analíticas',
        embed: () => new EmbedBuilder().setColor('#FEE75C').setTitle(`${E.analytics}  Analíticas`)
            .setDescription(
                `${EX.flecha} Estadísticas y métricas de tu tienda.\n\n` +
                `**\`/stats\`**\n${E.arrow} Pedidos por período.\n\n` +
                `**\`/top\`**\n${E.arrow} Ranking de operadores o clientes.\n\n` +
                `**\`/dashboard\`**\n${E.arrow} Resumen visual completo.\n\n` +
                `**\`/servidor-stats\`**\n${E.arrow} Tarjeta completa del servidor.\n\n` +
                `**\`/perfil [usuario]\`**\n${E.arrow} Estadísticas completas de un usuario.`
            ).setFooter({ text: `Bot • /help • Analíticas` }).setTimestamp()
    },
    reputacion: {
        label: 'Reputación',
        embed: () => new EmbedBuilder().setColor('#FEE75C').setTitle(`${E.review}  Reputación`)
            .setDescription(
                `${EX.flecha} Sistema de valoraciones.\n\n` +
                `**\`/reseña [orden]\`**\n${E.arrow} Califica del 1 al 5 una orden.\n\n` +
                `**\`/resenas [vendedor]\`**\n${E.arrow} Ver promedio y últimas valoraciones.`
            ).setFooter({ text: `Bot • /help • Reputación` }).setTimestamp()
    },
    tickets: {
        label: 'Tickets',
        embed: () => new EmbedBuilder().setColor('#3498DB').setTitle(`${E.ticket}  Tickets`)
            .setDescription(
                `${EX.flecha} Sistema de atención al cliente.\n\n` +
                `**\`/ticket-setup\`**\n${E.arrow} Configura y envía el panel de tickets.\n\n` +
                `**Categorías:** 🛒 Comprar · 🎧 Soporte · 🤝 Alianzas · ⚠️ Reportes · 🔔 Otros\n\n` +
                `${E.arrow} ${E.relojArena} Cooldown de **5 minutos** entre tickets.\n` +
                `${E.arrow} ${E.scroll} Transcript automático al cerrar.\n` +
                `${E.arrow} ${EX.nochee} Staff puede **reclamar** tickets.\n` +
                `${E.arrow} ${E.campana} Recordatorio al staff si hay >60 min sin respuesta.`
            ).setFooter({ text: `Bot • /help • Tickets` }).setTimestamp()
    },
    utilidades: {
        label: 'Utilidades',
        embed: () => new EmbedBuilder().setColor('#95A5A6').setTitle(`${E.bot}  Utilidades`)
            .setDescription(
                `${EX.flecha} Herramientas generales.\n\n` +
                `**\`/afk [motivo]\`**\n${E.arrow} Activa el modo AFK.\n\n` +
                `**\`/anuncio\`**\n${E.arrow} Envía un anuncio embed.\n\n` +
                `**\`/notificar\`**\n${E.arrow} DM masivo a clientes registrados.\n\n` +
                `**\`/sorteo\`**\n${E.arrow} Crea un sorteo con roles y participaciones.\n\n` +
                `**\`/clear [cantidad]\`**\n${E.arrow} Borra hasta 100 mensajes.\n\n` +
                `**\`/ping\`**\n${E.arrow} Latencia actual del bot.`
            ).setFooter({ text: `Bot • /help • Utilidades` }).setTimestamp()
    },
    config: {
        label: 'Configuración',
        embed: () => new EmbedBuilder().setColor('#ED4245').setTitle(`${E.settings}  Configuración`)
            .setDescription(
                `${EX.flecha} Solo administradores.\n\n` +
                `**\`/setlog\`** · **\`/setresenas\`** · **\`/configdm\`** · **\`/setdm\`**\n\n` +
                `**\`/settiers\`**\n${E.arrow} Roles por número de compras.\n\n` +
                `**\`/setvip [rol]\`**\n${E.arrow} Rol VIP para sorteos.\n\n` +
                `**\`/vip-setup\`**\n${E.arrow} Configura el comando /clubvip.\n\n` +
                `**\`/clubvip\`**\n${E.arrow} Asigna membresía VIP con duración.`
            ).setFooter({ text: `Bot • /help • Configuración` }).setTimestamp()
    }
};

function buildHelpInicio(guild) {
    return new EmbedBuilder().setColor('#5865F2')
        .setAuthor({ name: 'Bot', iconURL: client.user?.displayAvatarURL() ?? undefined })
        .setTitle(`${E.bot}  Panel de ayuda`)
        .setDescription(
            `${EX.flecha} Bienvenido al sistema de ayuda.\n${E.arrow} Selecciona una categoría con los botones.\n\n` +
            `${E.orders} **Pedidos** — Registrar y gestionar ventas\n` +
            `${EX.starr} **Analíticas** — Stats, rankings y dashboard\n` +
            `${E.review} **Reputación** — Reseñas y valoraciones\n` +
            `${EX.document} **Tickets** — Atención al cliente\n` +
            `${E.tools} **Utilidades** — Herramientas generales\n` +
            `${E.settings} **Configuración** — Ajustes del servidor`
        )
        .setThumbnail(guild?.iconURL({ dynamic: true }) ?? null)
        .setFooter({ text: `Bot • ${guild?.name ?? ''} · Usa los botones para navegar` })
        .setTimestamp();
}
function buildHelpRows() {
    const keys = Object.keys(HELP_CATEGORIAS);
    const row1 = new ActionRowBuilder().addComponents(
        keys.slice(0, 4).map(k =>
            new ButtonBuilder().setCustomId(`help_cat_${k}`).setLabel(HELP_CATEGORIAS[k].label).setStyle(ButtonStyle.Secondary)
        )
    );
    const row2 = new ActionRowBuilder().addComponents(
        ...keys.slice(4).map(k =>
            new ButtonBuilder().setCustomId(`help_cat_${k}`).setLabel(HELP_CATEGORIAS[k].label).setStyle(ButtonStyle.Secondary)
        ),
        new ButtonBuilder().setCustomId('help_inicio').setLabel('Inicio').setEmoji('🏠').setStyle(ButtonStyle.Primary)
    );
    return [row1, row2];
}

// ─── Tickets ──────────────────────────────────────────────────────────────────
const TICKET_COOLDOWN_MS = 5 * 60 * 1000;

// ─── Categorías de ticket (5 categorías como en la imagen referencia) ─────────
const CATEGORIAS = {
    comprar: {
        emoji: '🛒', label: 'Comprar',
        descripcion: '¿Estás interesado en adquirir nuestros productos?',
        // Nombre del canal: emoji + nombre de la categoría + número + usuario
        nombreCanal: (num, slug) => `🛒・comprar-${num}-${slug}`,
        color: '#57F287',
        bienvenida: (u) =>
            `### 🛒  Ticket de Compra\n` +
            `${EX.flecha} ¡Hola, **${u}**! Bienvenido a tu ticket de compra.\n` +
            `${E.arrow} Un operador te atenderá en breve.\n\n` +
            `**${EX.document} Para agilizar tu pedido:**\n` +
            `${E.line} ${EX.dinero} ¿Qué deseas adquirir?\n` +
            `${E.line} 💵 ¿Cuál es tu presupuesto?\n` +
            `${E.line} ${E.tarjeta} ¿Cuál es tu método de pago?`,
        modal: true
    },
    soporte: {
        emoji: '🎧', label: 'Dudas o Problemas',
        descripcion: '¿Tienes alguna pregunta o inconveniente que necesite atención?',
        nombreCanal: (num, slug) => `🎧・soporte-${num}-${slug}`,
        color: '#3498DB',
        bienvenida: (u) =>
            `### 🎧  Ticket de Soporte\n` +
            `${EX.flecha} ¡Hola, **${u}**! Abriste un ticket de soporte.\n` +
            `${E.arrow} Nuestro equipo revisará tu caso lo antes posible.\n\n` +
            `**${EX.document} Para ayudarte mejor:**\n` +
            `${E.line} ❓ ¿Qué ocurrió exactamente?\n` +
            `${E.line} ${E.orders} ¿Tienes número de orden?\n` +
            `${E.line} 📸 ¿Tienes capturas de pantalla?`,
        modal: false
    },
    alianzas: {
        emoji: '🤝', label: 'Alianzas',
        descripcion: '¿Quieres proponer una colaboración o formar parte de algo juntos?',
        nombreCanal: (num, slug) => `🤝・alianzas-${num}-${slug}`,
        color: '#9B59B6',
        bienvenida: (u) =>
            `### 🤝  Ticket de Alianza\n` +
            `${EX.flecha} ¡Hola, **${u}**! Gracias por tu interés en colaborar.\n` +
            `${E.arrow} Un miembro del equipo revisará tu propuesta.\n\n` +
            `**${EX.document} Para evaluar tu propuesta:**\n` +
            `${E.line} 🌐 ¿Con qué servidor o proyecto representas?\n` +
            `${E.line} 📊 ¿Cuántos miembros activos tienen?\n` +
            `${E.line} 💡 ¿Qué tipo de alianza propones?`,
        modal: false
    },
    reporte: {
        emoji: '⚠️', label: 'Reportes',
        descripcion: '¿Necesitas reportar algo o a alguien?',
        nombreCanal: (num, slug) => `⚠️・reporte-${num}-${slug}`,
        color: '#ED4245',
        bienvenida: (u) =>
            `### ⚠️  Ticket de Reporte\n` +
            `${EX.flecha} ¡Hola, **${u}**! Recibimos tu reporte.\n` +
            `${E.arrow} El staff lo revisará con seriedad.\n\n` +
            `**${EX.document} Necesitamos:**\n` +
            `${E.line} ${E.person} Usuario reportado\n` +
            `${E.line} 📝 Motivo detallado\n` +
            `${E.line} 📸 Evidencia\n` +
            `${E.line} 📅 ¿Cuándo ocurrió?`,
        modal: false
    },
    otros: {
        emoji: '🔔', label: 'Otro',
        descripcion: 'Otra consulta que no encaja en las opciones anteriores.',
        nombreCanal: (num, slug) => `🔔・otros-${num}-${slug}`,
        color: '#95A5A6',
        bienvenida: (u) =>
            `### 🔔  Ticket General\n` +
            `${EX.flecha} ¡Hola, **${u}**! Abriste un ticket general.\n` +
            `${E.arrow} Un miembro del staff te atenderá en breve.\n\n` +
            `**${EX.document} Cuéntanos:**\n` +
            `${E.line} ✏️ ¿En qué podemos ayudarte hoy?`,
        modal: false
    }
};

function contarTicketsPorCategoria(tickets, categoriaKey) {
    return tickets.filter(t => t.categoria === categoriaKey).length;
}

// ─── Panel de tickets (estilo imagen referencia) ──────────────────────────────
function buildPanelEmbed(guildName, imageUrl = null) {
    return new EmbedBuilder().setColor('#5865F2')
        .setTitle(`${E.ticket}  ¿En qué podemos ayudarte?`)
        .setDescription(
            `${EX.flecha} Selecciona la opción que se ajuste a tu necesidad.\n\n` +
            `🛒  **Comprar**\n${E.arrow} ¿Estás interesado en adquirir nuestros productos o servicios?\n\n` +
            `🎧  **Dudas o Problemas**\n${E.arrow} ¿Tienes alguna pregunta o inconveniente que necesite atención?\n\n` +
            `🤝  **Alianzas**\n${E.arrow} ¿Quieres proponer una colaboración o formar parte de algo juntos?\n\n` +
            `⚠️  **Reportes**\n${E.arrow} ¿Necesitas reportar algo o a alguien?\n\n` +
            `🔔  **Otro**\n${E.arrow} Otra consulta que no encaja en las opciones anteriores.`
        )
        .setImage(imageUrl ?? BANNER_URL)
        .setFooter({ text: `${guildName} · Bot` })
        .setTimestamp();
}

function buildPanelRow() {
    return new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('ticket_categoria')
            .setPlaceholder(`${E.arrow}  Selecciona una opción...`)
            .addOptions(
                new StringSelectMenuOptionBuilder()
                    .setLabel('Comprar')
                    .setDescription('¿Estás interesado en adquirir nuestros productos o servicios?')
                    .setEmoji('🛒')
                    .setValue('comprar'),
                new StringSelectMenuOptionBuilder()
                    .setLabel('Dudas o Problemas')
                    .setDescription('¿Tienes alguna pregunta o inconveniente que necesite atención?')
                    .setEmoji('🎧')
                    .setValue('soporte'),
                new StringSelectMenuOptionBuilder()
                    .setLabel('Alianzas')
                    .setDescription('¿Quieres proponer una colaboración o formar parte de algo?')
                    .setEmoji('🤝')
                    .setValue('alianzas'),
                new StringSelectMenuOptionBuilder()
                    .setLabel('Reportes')
                    .setDescription('¿Necesitas reportar algo o a alguien?')
                    .setEmoji('⚠️')
                    .setValue('reporte'),
                new StringSelectMenuOptionBuilder()
                    .setLabel('Otro')
                    .setDescription('Otra consulta que no encaja en las opciones anteriores.')
                    .setEmoji('🔔')
                    .setValue('otros')
            )
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

// ─── Ticket Setup ─────────────────────────────────────────────────────────────
async function handleTicketSetup(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator))
        return safeReply(interaction, { content: `${EX.warning} Solo administradores pueden usar este comando.` });

    const ok = await safeDefer(interaction, true);
    if (!ok) return;

    const tdata            = loadTickets(interaction.guild.id);
    const canal            = interaction.options.getChannel('canal');
    const categoriaDiscord = interaction.options.getChannel('categoria') ?? null;
    const logCanal         = interaction.options.getChannel('logs')      ?? null;
    const vendedorRol      = interaction.options.getRole('rol_vendedor') ?? null;
    const staffRol         = interaction.options.getRole('rol_staff')    ?? null;
    const imagenUrl        = interaction.options.getString('imagen')     ?? null;

    if (categoriaDiscord?.id) tdata.config.categoryId      = categoriaDiscord.id;
    if (logCanal?.id)         tdata.config.logChannelId    = logCanal.id;
    if (vendedorRol?.id)      tdata.config.vendedorRoleId  = vendedorRol.id;
    if (staffRol?.id)         tdata.config.staffRoleId     = staffRol.id;
    if (imagenUrl)            tdata.config.panelImageUrl   = imagenUrl;

    const embedPanel = buildPanelEmbed(interaction.guild.name, tdata.config.panelImageUrl);
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

    const lineas = [
        `${E.check} Panel ${panelActualizado ? 'actualizado' : `enviado a <#${canal.id}>`}`,
        categoriaDiscord ? `${EX.document} Categoría: **${categoriaDiscord.name}**` : '',
        logCanal         ? `${E.scroll} Logs: <#${logCanal.id}>`                  : '',
        vendedorRol      ? `${EX.nochee} Rol vendedor: **${vendedorRol.name}**`    : '',
        staffRol         ? `${E.escudo} Rol staff: **${staffRol.name}**`           : '',
        imagenUrl        ? `🖼️ Imagen del banner actualizada`                      : ''
    ].filter(Boolean).join('\n');

    return interaction.editReply({ content: lineas });
}

// ─── Botones dentro del ticket ────────────────────────────────────────────────
function buildTicketRow(ticketId, reclamado = false) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`ticket_reclamar_${ticketId}`)
            .setLabel(reclamado ? '✋ Reclamado' : '✋ Reclamar')
            .setStyle(reclamado ? ButtonStyle.Secondary : ButtonStyle.Primary)
            .setDisabled(reclamado),
        new ButtonBuilder()
            .setCustomId(`ticket_cerrar_${ticketId}`)
            .setLabel('🔒 Cerrar ticket')
            .setStyle(ButtonStyle.Danger)
    );
}

// ─── Apertura de ticket ───────────────────────────────────────────────────────
async function abrirTicket(interaction, categoriaKey, datosModal = null) {
    const guild = interaction.guild;
    const user  = interaction.user;
    const cat   = CATEGORIAS[categoriaKey];
    if (!cat) return safeReply(interaction, { content: `${EX.warning} Categoría de ticket no válida.` });

    const lockKey = `${guild.id}-${user.id}`;
    if (ticketLocks.has(lockKey))
        return safeReply(interaction, { content: `${E.relojArena} Ya se está procesando tu ticket, espera un momento...` });
    ticketLocks.add(lockKey);

    try {
        const tdata = loadTickets(guild.id);

        // Verificar ticket ya abierto
        const ticketAbierto = tdata.tickets.find(t => t.userId === user.id && t.estado === 'abierto');
        if (ticketAbierto) {
            const existe = await guild.channels.fetch(ticketAbierto.channelId).catch(() => null);
            if (existe) return safeReply(interaction, { content: `${EX.warning} Ya tienes un ticket abierto: <#${ticketAbierto.channelId}>` });
            // Canal eliminado manualmente — limpiar
            ticketAbierto.estado    = 'cerrado';
            ticketAbierto.cerradoPor = 'Sistema (canal eliminado)';
            ticketAbierto.cerradoAt  = Date.now();
            saveTickets(guild.id, tdata);
        }

        // Verificar cooldown
        const ultimoTicket = tdata.cooldowns[user.id] ?? 0;
        const restante = TICKET_COOLDOWN_MS - (Date.now() - ultimoTicket);
        if (restante > 0 && ultimoTicket > 0)
            return safeReply(interaction, { content: `${E.relojArena} Espera **${Math.ceil(restante / 60000)} min** antes de abrir otro ticket.` });

        if (!guild.members.me.permissions.has(PermissionFlagsBits.ManageChannels))
            return safeReply(interaction, { content: `${EX.warning} **Faltan permisos.** El bot necesita **Gestionar canales**.` });

        // ─── Nombre del canal con emoji unicode ───────────────────────────
        const numCat   = contarTicketsPorCategoria(tdata.tickets, categoriaKey) + 1;
        const userSlug = user.username.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 15) || 'usuario';
        const nombreCanal = cat.nombreCanal(numCat, userSlug);

        // Permisos del canal
        const permisos = [
            { id: guild.id,            deny:  [PermissionFlagsBits.ViewChannel] },
            { id: user.id,             allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
            { id: guild.members.me.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageMessages, PermissionFlagsBits.ManageChannels] }
        ];
        if (tdata.config.staffRoleId) permisos.push({
            id: tdata.config.staffRoleId,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageMessages]
        });
        if (categoriaKey === 'comprar' && tdata.config.vendedorRoleId) permisos.push({
            id: tdata.config.vendedorRoleId,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
        });

        const canalTicket = await guild.channels.create({
            name: nombreCanal,
            type: ChannelType.GuildText,
            parent: tdata.config.categoryId ?? null,
            permissionOverwrites: permisos
        });

        const ticketId = nextTicketId(tdata.tickets);
        tdata.tickets.push({
            id: ticketId,
            numero: numCat,
            channelId: canalTicket.id,
            userId: user.id,
            userTag: user.tag,
            categoria: categoriaKey,
            estado: 'abierto',
            timestamp: Date.now(),
            datosModal,
            ultimaActividad: Date.now(),
            recordatorioEnviado: false,
            reclamadoPor: null,
            reclamadoTag: null
        });
        tdata.cooldowns[user.id] = Date.now();
        saveTickets(guild.id, tdata);

        let descripcion = cat.bienvenida(user.username);
        if (datosModal) {
            descripcion +=
                `\n\n**${EX.document} Datos de tu pedido:**\n` +
                `${E.arrow} ${EX.dinero} **Cantidad:** \`${datosModal.cantidad}\`\n` +
                `${E.arrow} 💵 **Presupuesto:** \`${datosModal.precio}\`\n` +
                `${E.arrow} ${E.tarjeta} **Método:** \`${datosModal.metodo}\``;
        }

        const embedBienvenida = new EmbedBuilder()
            .setColor(cat.color)
            .setImage(BANNER_URL)
            .setDescription(descripcion)
            .setFooter({ text: `${E.ticket} Ticket #${ticketId} (${cat.label} ${numCat}) • ${guild.name}` })
            .setTimestamp();

        const menciones = [`<@${user.id}>`];
        if (categoriaKey === 'comprar' && tdata.config.vendedorRoleId) menciones.push(`<@&${tdata.config.vendedorRoleId}>`);
        else if (tdata.config.staffRoleId) menciones.push(`<@&${tdata.config.staffRoleId}>`);

        await canalTicket.send({
            content: menciones.join(' '),
            embeds: [embedBienvenida],
            components: [buildTicketRow(ticketId, false)]
        }).catch(() => {});

        await logTicket(guild, tdata, new EmbedBuilder().setColor('#57F287')
            .setTitle(`${E.ticket}  Ticket #${ticketId} abierto`)
            .setDescription(
                `${E.arrow} ${E.person} **Usuario:** <@${user.id}> (\`${user.tag}\`)\n` +
                `${E.arrow} ${EX.document} **Categoría:** \`${cat.label} ${numCat}\`\n` +
                `${E.arrow} ${E.pin} **Canal:** <#${canalTicket.id}>`
            ).setTimestamp());

        return safeReply(interaction, { content: `${E.check} Tu ticket fue creado: <#${canalTicket.id}>` });
    } finally {
        ticketLocks.delete(lockKey);
    }
}

// ─── Reclamar ticket ──────────────────────────────────────────────────────────
async function reclamarTicket(interaction, ticketId) {
    const guild  = interaction.guild;
    const tdata  = loadTickets(guild.id);
    const ticket = tdata.tickets.find(t => t.id === ticketId);

    if (!ticket || ticket.estado === 'cerrado')
        return safeReply(interaction, { content: `${EX.warning} Este ticket ya fue cerrado.` });

    const esStaff = tdata.config.staffRoleId ? interaction.member.roles.cache.has(tdata.config.staffRoleId) : false;
    const esAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);

    if (!esStaff && !esAdmin)
        return safeReply(interaction, { content: `${E.escudo} Solo el staff puede reclamar tickets.` });

    if (interaction.user.id === ticket.userId)
        return safeReply(interaction, { content: `${EX.warning} No puedes reclamar tu propio ticket.` });

    if (ticket.reclamadoPor && ticket.reclamadoPor !== interaction.user.id)
        return safeReply(interaction, { content: `${EX.warning} Este ticket ya fue reclamado por <@${ticket.reclamadoPor}>.` });

    if (ticket.reclamadoPor === interaction.user.id)
        return safeReply(interaction, { content: `${EX.nochee} Tú ya tienes este ticket reclamado.` });

    ticket.reclamadoPor = interaction.user.id;
    ticket.reclamadoTag = interaction.user.tag;
    ticket.reclamadoAt  = Date.now();
    saveTickets(guild.id, tdata);

    try {
        const canal = interaction.channel;
        if (tdata.config.staffRoleId) {
            await canal.permissionOverwrites.edit(tdata.config.staffRoleId, { ViewChannel: false }).catch(() => {});
        }
        await canal.permissionOverwrites.edit(interaction.user.id, {
            ViewChannel: true, SendMessages: true, ReadMessageHistory: true
        }).catch(() => {});
    } catch { }

    const embedReclamado = new EmbedBuilder().setColor('#FEE75C')
        .setTitle(`${EX.nochee}  Ticket reclamado`)
        .setDescription(
            `${E.arrow} ${E.escudo} **Atendido por:** <@${interaction.user.id}>\n` +
            `${E.arrow} ${E.person} **Cliente:** <@${ticket.userId}>\n\n` +
            `${E.line} *Los demás staff ya no pueden ver este ticket.*`
        ).setFooter({ text: `Bot • ${today()}` }).setTimestamp();

    await interaction.message.edit({ components: [buildTicketRow(ticketId, true)] }).catch(() => {});
    await interaction.channel.send({ embeds: [embedReclamado] }).catch(() => {});
    await safeReply(interaction, { content: `${E.check} Ticket reclamado correctamente.` });

    await logTicket(guild, tdata, new EmbedBuilder().setColor('#FEE75C')
        .setTitle(`${E.ticket}  Ticket #${ticketId} reclamado`)
        .setDescription(
            `${E.arrow} ${E.escudo} **Staff:** <@${interaction.user.id}> (\`${interaction.user.tag}\`)\n` +
            `${E.arrow} ${E.person} **Cliente:** <@${ticket.userId}>`
        ).setTimestamp());
}

// ─── Cerrar ticket (con confirmación) ────────────────────────────────────────
async function cerrarTicketConfirm(interaction, ticketId) {
    const tdata  = loadTickets(interaction.guild.id);
    const ticket = tdata.tickets.find(t => t.id === ticketId);
    if (!ticket || ticket.estado === 'cerrado')
        return safeReply(interaction, { content: `${EX.warning} Este ticket ya fue cerrado.` });

    const esAdmin      = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
    const esStaff      = tdata.config.staffRoleId ? interaction.member.roles.cache.has(tdata.config.staffRoleId) : false;
    const esReclamador = ticket.reclamadoPor === interaction.user.id;
    const esDueno      = interaction.user.id === ticket.userId;

    if (!esAdmin && !esStaff && !esReclamador && !esDueno)
        return safeReply(interaction, { content: '🚫 Sin permiso para cerrar este ticket.' });

    const embedConfirm = new EmbedBuilder().setColor('#ED4245')
        .setTitle(`${E.lock}  ¿Cerrar este ticket?`)
        .setDescription(
            `${E.arrow} ${E.person} **Cliente:** <@${ticket.userId}>\n` +
            `${E.arrow} ${E.escudo} **Reclamado por:** \`${ticket.reclamadoTag ?? 'Sin reclamar'}\`\n\n` +
            `*Elige una acción:*\n` +
            `${E.line} 🔒 **Cerrar** — Genera transcript y elimina el canal.\n` +
            `${E.line} 🔓 **Reabrir** — Restaura el acceso al ticket.\n` +
            `${E.line} ❌ **Cancelar** — No hacer nada.`
        ).setTimestamp();

    const rowConfirm = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`ticket_confirm_cerrar_${ticketId}`).setLabel('🔒 Cerrar').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId(`ticket_reabrir_${ticketId}`).setLabel('🔓 Reabrir').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`ticket_cancelar_cierre_${ticketId}`).setLabel('❌ Cancelar').setStyle(ButtonStyle.Secondary)
    );

    return safeReply(interaction, { embeds: [embedConfirm], components: [rowConfirm] });
}

// ─── Ejecutar cierre real del ticket ─────────────────────────────────────────
async function ejecutarCierreTicket(interaction, ticketId) {
    const guild  = interaction.guild;
    const tdata  = loadTickets(guild.id);
    const ticket = tdata.tickets.find(t => t.id === ticketId);
    if (!ticket || ticket.estado === 'cerrado')
        return safeUpdate(interaction, { content: `${EX.warning} Este ticket ya fue cerrado.`, embeds: [], components: [] });

    const ok = await safeDefer(interaction);
    if (!ok) return;

    // Recopilar transcript
    let todosLosMensajes = [];
    let before;
    while (true) {
        const batch = await interaction.channel.messages.fetch({ limit: 100, ...(before ? { before } : {}) }).catch(() => null);
        if (!batch || batch.size === 0) break;
        todosLosMensajes.push(...batch.values());
        before = batch.last().id;
        if (batch.size < 100) break;
    }
    todosLosMensajes.reverse();

    const closedAt = Date.now();
    const cat      = CATEGORIAS[ticket.categoria] ?? { emoji: '🎫', label: 'Ticket' };
    const duracion = calcDuracion(ticket.timestamp, closedAt);

    let transcript =
        `TRANSCRIPT — Ticket #${ticket.id} (${cat.label} ${ticket.numero ?? ''})\n` +
        `Usuario: ${ticket.userTag}\n` +
        `Reclamado por: ${ticket.reclamadoTag ?? 'Sin reclamar'}\n` +
        `Cerrado por: ${interaction.user.tag}\n` +
        `Fecha apertura: ${new Date(ticket.timestamp).toLocaleString('es-MX')}\n` +
        `Fecha cierre: ${new Date(closedAt).toLocaleString('es-MX')}\n` +
        `Duración: ${duracion}\n` +
        `${'─'.repeat(60)}\n\n`;

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

    await interaction.editReply({
        embeds: [new EmbedBuilder().setColor('#ED4245')
            .setTitle(`${E.lock}  Ticket cerrado`)
            .setDescription(
                `${E.arrow} Cerrado por <@${interaction.user.id}>\n` +
                `${E.arrow} El canal se eliminará en **5 segundos**.`
            ).setTimestamp()],
        components: []
    }).catch(() => {});

    // DM al usuario
    try {
        const gdata   = loadData(guild.id);
        const dmTexto = gdata.config.dmCierreTexto
            ?? `¡Hola, **{usuario}**! 👋\n\nEsperamos haberte atendido de la mejor manera en **{servidor}**.\n\n*Si tuviste algún inconveniente, abre un nuevo ticket.*`;
        const buffer  = Buffer.from(transcript, 'utf8');
        const miembro = await guild.members.fetch(ticket.userId).catch(() => null);
        if (miembro) {
            const embedDM = new EmbedBuilder().setColor('#5865F2')
                .setAuthor({ name: guild.name, iconURL: guild.iconURL({ dynamic: true }) ?? undefined })
                .setTitle(`${E.ticket}  Tu ticket fue cerrado`)
                .setThumbnail(guild.iconURL({ dynamic: true }) ?? null)
                .setDescription(
                    `${E.arrow} **Servidor:** \`${guild.name}\`\n` +
                    `${E.arrow} **Categoría:** \`${cat.label} ${ticket.numero ?? ''}\`\n` +
                    `${E.arrow} **Atendido por:** \`${ticket.reclamadoTag ?? 'Sin asignar'}\`\n` +
                    `${E.arrow} **Cerrado por:** \`${interaction.user.tag}\`\n` +
                    `${E.arrow} **Duración:** \`${duracion}\`\n\n` +
                    `━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                    dmTexto.replace('{usuario}', ticket.userTag.split('#')[0]).replace('{servidor}', guild.name)
                ).setFooter({ text: `${guild.name} · Bot` }).setTimestamp();
            await enviarDM(miembro.user, embedDM, { files: [{ attachment: buffer, name: `transcript-ticket${ticketId}.txt` }] });
        }
    } catch (e) { console.warn('⚠️ DM cierre fallido:', e?.message); }

    const bufferLog = Buffer.from(transcript, 'utf8');
    await logTicket(guild, tdata,
        new EmbedBuilder().setColor('#ED4245')
            .setTitle(`${E.ticket}  Ticket #${ticketId} cerrado`)
            .setDescription(
                `${E.arrow} ${E.person} **Usuario:** <@${ticket.userId}> (\`${ticket.userTag}\`)\n` +
                `${E.arrow} ${EX.document} **Categoría:** \`${cat.label} ${ticket.numero ?? ''}\`\n` +
                `${E.arrow} ${E.escudo} **Reclamado por:** \`${ticket.reclamadoTag ?? 'Sin reclamar'}\`\n` +
                `${E.arrow} ${E.lock} **Cerrado por:** \`${interaction.user.tag}\`\n` +
                `${E.arrow} ⏱️ **Duración:** \`${duracion}\``
            ).setTimestamp(),
        { attachment: bufferLog, name: `transcript-ticket${ticketId}.txt` }
    );

    setTimeout(() => { interaction.channel.delete().catch(() => {}); }, 5000);
}

// ─── Reabrir ticket ───────────────────────────────────────────────────────────
async function reabrirTicket(interaction, ticketId) {
    const guild  = interaction.guild;
    const tdata  = loadTickets(guild.id);
    const ticket = tdata.tickets.find(t => t.id === ticketId);

    if (!ticket)
        return safeUpdate(interaction, { content: `${EX.warning} Ticket no encontrado.`, embeds: [], components: [] });

    const esAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
    const esStaff = tdata.config.staffRoleId ? interaction.member.roles.cache.has(tdata.config.staffRoleId) : false;
    if (!esAdmin && !esStaff)
        return safeReply(interaction, { content: '🚫 Solo el staff puede reabrir tickets.' });

    try {
        if (tdata.config.staffRoleId) {
            await interaction.channel.permissionOverwrites.edit(tdata.config.staffRoleId, {
                ViewChannel: true, SendMessages: true, ReadMessageHistory: true
            }).catch(() => {});
        }
        if (ticket.reclamadoPor) {
            await interaction.channel.permissionOverwrites.delete(ticket.reclamadoPor).catch(() => {});
        }
    } catch { }

    ticket.reclamadoPor = null;
    ticket.reclamadoTag = null;
    ticket.reclamadoAt  = null;
    ticket.estado       = 'abierto';
    saveTickets(guild.id, tdata);

    const embedReabierto = new EmbedBuilder().setColor('#57F287')
        .setTitle(`${E.unlock}  Ticket reabierto`)
        .setDescription(
            `${E.arrow} Reabierto por <@${interaction.user.id}>\n` +
            `${E.arrow} ${E.person} **Cliente:** <@${ticket.userId}>\n\n` +
            `${E.line} *El ticket está activo nuevamente.*`
        ).setTimestamp();

    await safeUpdate(interaction, { embeds: [embedReabierto], components: [buildTicketRow(ticketId, false)] });

    const menciones = [`<@${ticket.userId}>`];
    if (tdata.config.staffRoleId) menciones.push(`<@&${tdata.config.staffRoleId}>`);
    await interaction.channel.send({ content: menciones.join(' ') }).catch(() => {});
}

// ─── handleTicketInteraction ──────────────────────────────────────────────────
async function handleTicketInteraction(interaction) {
    // Select menu — abrir ticket
    if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_categoria') {
        const categoriaKey = interaction.values[0];
        const cat = CATEGORIAS[categoriaKey];
        if (!cat) return safeReply(interaction, { content: `${EX.warning} Categoría no válida.` });

        if (cat.modal) {
            const modal = new ModalBuilder()
                .setCustomId(`ticket_modal_${categoriaKey}`)
                .setTitle(`Ticket — ${cat.label}`);
            modal.addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder().setCustomId('cantidad').setLabel('¿Qué deseas adquirir?')
                        .setPlaceholder('Ej: Plan Premium, acceso vip').setStyle(TextInputStyle.Short).setRequired(true)
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder().setCustomId('precio').setLabel('¿Cuál es tu presupuesto?')
                        .setPlaceholder('Ej: $5 USD, 130 MXN').setStyle(TextInputStyle.Short).setRequired(true)
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder().setCustomId('metodo').setLabel('¿Método de pago?')
                        .setPlaceholder('Ej: PayPal, Binance, Mercado Pago').setStyle(TextInputStyle.Short).setRequired(true)
                )
            );
            await interaction.showModal(modal).catch(e => { if (!isIgnorableError(e)) console.warn('⚠️ showModal:', e?.message); });
            return;
        }

        const ok = await safeDefer(interaction, true);
        if (!ok) return;
        return abrirTicket(interaction, categoriaKey);
    }

    // Modal submit — comprar
    if (interaction.isModalSubmit() && interaction.customId.startsWith('ticket_modal_')) {
        const ok = await safeDefer(interaction, true);
        if (!ok) return;
        return abrirTicket(interaction, interaction.customId.replace('ticket_modal_', ''), {
            cantidad: interaction.fields.getTextInputValue('cantidad'),
            precio:   interaction.fields.getTextInputValue('precio'),
            metodo:   interaction.fields.getTextInputValue('metodo')
        });
    }

    // Botón: reclamar
    if (interaction.isButton() && interaction.customId.startsWith('ticket_reclamar_'))
        return reclamarTicket(interaction, parseInt(interaction.customId.replace('ticket_reclamar_', '')));

    // Botón: cerrar (pide confirmación)
    if (interaction.isButton() && interaction.customId.startsWith('ticket_cerrar_'))
        return cerrarTicketConfirm(interaction, parseInt(interaction.customId.replace('ticket_cerrar_', '')));

    // Botón: confirmar cierre real
    if (interaction.isButton() && interaction.customId.startsWith('ticket_confirm_cerrar_'))
        return ejecutarCierreTicket(interaction, parseInt(interaction.customId.replace('ticket_confirm_cerrar_', '')));

    // Botón: reabrir
    if (interaction.isButton() && interaction.customId.startsWith('ticket_reabrir_'))
        return reabrirTicket(interaction, parseInt(interaction.customId.replace('ticket_reabrir_', '')));

    // Botón: cancelar cierre
    if (interaction.isButton() && interaction.customId.startsWith('ticket_cancelar_cierre_'))
        return safeUpdate(interaction, { content: `${E.check} Cierre cancelado.`, embeds: [], components: [] });
}

// ─── Sorteos ──────────────────────────────────────────────────────────────────
function buildSorteoEmbed(sorteo, guildName) {
    const ahora     = Date.now();
    const terminado = ahora >= sorteo.fin;
    const tiempoRestante = terminado ? 'Finalizado' : formatDuracionMs(sorteo.fin - ahora);
    const participantes  = sorteo.participantes?.length ?? 0;
    const totalEntradas  = sorteo.participantes?.reduce((s, p) => s + (p.entradas ?? 1), 0) ?? 0;

    let listaParticipantes = '';
    if (sorteo.participantes?.length > 0) {
        const visibles = sorteo.participantes.slice(0, 10);
        listaParticipantes = '\n\n**🎟️ Participantes:**\n' +
            visibles.map(p => `${E.line} <@${p.userId}> — \`${p.entradas}\` entrada(s)`).join('\n') +
            (sorteo.participantes.length > 10 ? `\n${E.line} *...y ${sorteo.participantes.length - 10} más.*` : '');
    }

    let rolesDesc = '';
    if (sorteo.roles?.length > 0) {
        rolesDesc = '\n\n**🎖️ Bonus por rol:**\n' +
            sorteo.roles.map(r => `${E.line} <@&${r.roleId}> — \`${r.entradas}\` participación(es)`).join('\n');
    }

    return new EmbedBuilder()
        .setColor(terminado ? '#ED4245' : '#FEE75C')
        .setTitle(`${EX.gifr}  Sorteo — ${sorteo.premio}`)
        .setDescription(
            `${E.arrow} ${EX.dinero} **Premio:** \`${sorteo.premio}\`\n` +
            `${E.arrow} ${E.reloj} **Tiempo restante:** \`${tiempoRestante}\`\n` +
            `${E.arrow} ${E.person} **Participantes:** \`${participantes}\`\n` +
            `${E.arrow} 🎟️ **Entradas totales:** \`${totalEntradas}\`\n` +
            `${E.arrow} ${EX.bluecrown} **Ganadores:** \`${sorteo.cantGanadores}\`\n` +
            `${E.arrow} ${EX.nochee} **Host:** <@${sorteo.hostId}>` +
            rolesDesc + listaParticipantes +
            (terminado && sorteo.ganadores?.length
                ? `\n\n**${EX.bluecrown} Ganador${sorteo.ganadores.length > 1 ? 'es' : ''}:**\n${sorteo.ganadores.map(id => `${E.arrow} <@${id}>`).join('\n')}`
                : terminado ? `\n\n${E.arrow} *Sin participantes.*` : '')
        )
        .setImage(sorteo.imagen ?? BANNER_URL)
        .setFooter({ text: `${guildName} · Bot · ID: ${sorteo.id}` })
        .setTimestamp();
}
function buildSorteoRow(sorteoId, disabled = false) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`sorteo_participar_${sorteoId}`).setLabel('🎟️ Participar').setStyle(ButtonStyle.Success).setDisabled(disabled),
        new ButtonBuilder().setCustomId(`sorteo_finalizar_${sorteoId}`).setLabel('🏁 Finalizar').setStyle(ButtonStyle.Danger).setDisabled(disabled)
    );
}
function calcularEntradas(sorteo, userId, miembro) {
    if (sorteo.roles?.length > 0 && miembro) {
        for (const rolConf of sorteo.roles) {
            if (miembro.roles.cache.has(rolConf.roleId)) return rolConf.entradas;
        }
    }
    return 1;
}
function elegirGanadores(participantes, cantidad) {
    const pool = [];
    for (const p of participantes) { for (let i = 0; i < (p.entradas ?? 1); i++) pool.push(p.userId); }
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
    const data   = loadData(interaction.guild.id);
    const sorteo = data.sorteos.find(s => s.id === sorteoId);
    if (!sorteo) return safeReply(interaction, { content: `${EX.warning} Este sorteo ya no existe.` });
    if (Date.now() >= sorteo.fin || sorteo.estado !== 'activo')
        return safeReply(interaction, { content: `${E.relojArena} Este sorteo ya terminó.` });

    const yaParticipa = sorteo.participantes?.find(p => p.userId === interaction.user.id);
    if (yaParticipa) return safeReply(interaction, { content: `${E.check} Ya participas con **${yaParticipa.entradas}** entrada(s). ¡Buena suerte!` });

    const entradas = calcularEntradas(sorteo, interaction.user.id, interaction.member);
    if (!sorteo.participantes) sorteo.participantes = [];
    sorteo.participantes.push({ userId: interaction.user.id, userTag: interaction.user.username, entradas });
    saveData(interaction.guild.id, data);

    try {
        await interaction.message.edit({ embeds: [buildSorteoEmbed(sorteo, interaction.guild.name)], components: [buildSorteoRow(sorteoId)] }).catch(() => {});
    } catch { }

    return safeReply(interaction, {
        content: `🎟️ ¡Participas con **${entradas}** entrada(s)!${entradas > 1 ? `\n${E.line} *Bonus de rol aplicado.*` : ''}`
    });
}

async function handleSorteoFinalizar(interaction, sorteoId) {
    const data   = loadData(interaction.guild.id);
    const sorteo = data.sorteos.find(s => s.id === sorteoId);
    if (!sorteo) return safeReply(interaction, { content: `${EX.warning} Sorteo no encontrado.` });
    if (sorteo.estado === 'finalizado') return safeReply(interaction, { content: `${EX.warning} Este sorteo ya fue finalizado.` });

    const esAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
    if (interaction.user.id !== sorteo.hostId && !esAdmin)
        return safeReply(interaction, { content: `🚫 Solo el host (<@${sorteo.hostId}>) o un administrador puede finalizar este sorteo.` });

    sorteo.estado    = 'finalizado';
    sorteo.fin       = Date.now();
    sorteo.ganadores = elegirGanadores(sorteo.participantes ?? [], sorteo.cantGanadores);
    saveData(interaction.guild.id, data);

    await safeUpdate(interaction, { embeds: [buildSorteoEmbed(sorteo, interaction.guild.name)], components: [buildSorteoRow(sorteoId, true)] });

    if (sorteo.ganadores.length > 0) {
        await interaction.channel.send({
            content: `🎉 **¡Felicitaciones!** ${sorteo.ganadores.map(id => `<@${id}>`).join(', ')}\n${E.arrow} ¡Ganaste el sorteo de **${sorteo.premio}**! 🎁\n${E.line} *Si no reclamas en 24h, el host puede hacer \`$reroll ${sorteo.id}\`*`
        }).catch(() => {});
    } else {
        await interaction.channel.send({ content: `😔 El sorteo terminó sin participantes suficientes.` }).catch(() => {});
    }
}

async function verificarSorteos() {
    for (const guild of client.guilds.cache.values()) {
        if (ALLOWED_GUILDS.length > 0 && !ALLOWED_GUILDS.includes(guild.id)) continue;
        try {
            const data  = loadData(guild.id);
            if (!data.sorteos?.length) continue;
            const ahora = Date.now();
            let cambio  = false;
            for (const sorteo of data.sorteos) {
                if (sorteo.estado !== 'activo' || sorteo.fin > ahora) continue;
                sorteo.estado    = 'finalizado';
                sorteo.ganadores = elegirGanadores(sorteo.participantes ?? [], sorteo.cantGanadores);
                cambio = true;
                try {
                    const canal = guild.channels.cache.get(sorteo.canalId) ?? await guild.channels.fetch(sorteo.canalId).catch(() => null);
                    if (canal) {
                        if (sorteo.messageId) {
                            const msg = await canal.messages.fetch(sorteo.messageId).catch(() => null);
                            if (msg) await msg.edit({ embeds: [buildSorteoEmbed(sorteo, guild.name)], components: [buildSorteoRow(sorteo.id, true)] }).catch(() => {});
                        }
                        if (sorteo.ganadores.length > 0) {
                            await canal.send({ content: `🎉 **¡El sorteo terminó!** ${sorteo.ganadores.map(id => `<@${id}>`).join(', ')}\n${E.arrow} ¡Ganaste **${sorteo.premio}**! 🎁` }).catch(() => {});
                        } else {
                            await canal.send({ content: '😔 El sorteo terminó sin participantes.' }).catch(() => {});
                        }
                    }
                } catch (e) { console.warn(`⚠️ verificarSorteos [${guild.name}]:`, e?.message); }
            }
            data.sorteos = data.sorteos.filter(s => Date.now() - (s.timestamp ?? 0) < 7 * 24 * 60 * 60 * 1000);
            if (cambio) saveData(guild.id, data);
        } catch (e) { console.warn(`⚠️ verificarSorteos [${guild.name}]:`, e?.message); }
    }
}

async function handleSorteo(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator))
        return safeReply(interaction, { content: '🚫 Solo administradores.' });

    const premio        = interaction.options.getString('premio');
    const durStr        = interaction.options.getString('duracion') ?? '1h';
    const cantGanadores = interaction.options.getInteger('ganadores') ?? 1;
    const imagenUrl     = interaction.options.getString('imagen') ?? null;

    const durMs = parseDuracion(durStr);
    if (!durMs)
        return safeReply(interaction, { content: `${EX.warning} Duración inválida. Usa formatos como: \`30s\` \`10m\` \`2h\` \`1d\`.` });

    if (imagenUrl) { try { new URL(imagenUrl); } catch { return safeReply(interaction, { content: `${EX.warning} URL de imagen no válida.` }); } }

    const roles = [];
    for (let i = 1; i <= 4; i++) {
        const rol      = interaction.options.getRole(`rol_${i}`)      ?? null;
        const entradas = interaction.options.getInteger(`entradas_${i}`) ?? null;
        if (rol && entradas != null && entradas > 0) {
            roles.push({ roleId: rol.id, roleName: rol.name, entradas });
        }
    }

    const data     = loadData(interaction.guild.id);
    const sorteoId = `${interaction.guild.id}_${Date.now()}`;
    const fin      = Date.now() + durMs;
    const sorteo   = {
        id: sorteoId, premio, fin, cantGanadores, roles,
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
    const data   = loadData(message.guild.id);
    const sorteo = data.sorteos?.find(s => s.id === sorteoId);
    if (!sorteo) return message.reply(`${EX.warning} No se encontró ese sorteo.`).catch(() => {});
    if (sorteo.estado !== 'finalizado') return message.reply(`${EX.warning} El sorteo aún no ha finalizado.`).catch(() => {});

    const esAdmin = message.member?.permissions.has(PermissionFlagsBits.Administrator);
    if (message.author.id !== sorteo.hostId && !esAdmin)
        return message.reply(`🚫 Solo el host puede hacer reroll.`).catch(() => {});

    if (!sorteo.participantes?.length) return message.reply(`😔 No hay participantes.`).catch(() => {});

    sorteo.ganadores = elegirGanadores(sorteo.participantes, sorteo.cantGanadores);
    saveData(message.guild.id, data);

    const embedReroll = new EmbedBuilder().setColor('#FEE75C')
        .setTitle(`${EX.gifr}  Reroll — ${sorteo.premio}`)
        .setDescription(
            `${E.arrow} ${EX.dinero} **Premio:** \`${sorteo.premio}\`\n` +
            `${E.arrow} ${EX.bluecrown} **Nuevo${sorteo.ganadores.length > 1 ? 's ganadores' : ' ganador'}:**\n` +
            sorteo.ganadores.map(id => `${E.line} <@${id}>`).join('\n') +
            `\n\n${E.line} *Reroll por <@${message.author.id}>*`
        ).setFooter({ text: `Bot · ID: ${sorteoId}` }).setTimestamp();

    await message.channel.send({
        content: sorteo.ganadores.length > 0
            ? `🔄 **¡Nuevo ganador!** ${sorteo.ganadores.map(id => `<@${id}>`).join(', ')}\n${E.arrow} ¡Ganaste el sorteo de **${sorteo.premio}**! 🎁`
            : '😔 No se pudo elegir un nuevo ganador.',
        embeds: [embedReroll]
    }).catch(() => {});
}

// ─── Notificar ────────────────────────────────────────────────────────────────
async function handleNotificar(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator))
        return safeReply(interaction, { content: '🚫 Solo administradores.' });

    const mensaje     = interaction.options.getString('mensaje');
    const titulo      = interaction.options.getString('titulo') ?? `${EX.gifr}  Mensaje del servidor`;
    const soloActivos = interaction.options.getBoolean('solo_activos') ?? false;
    const imagenUrl   = interaction.options.getString('imagen') ?? null;

    const ok = await safeDefer(interaction, true);
    if (!ok) return;

    const data        = loadData(interaction.guild.id);
    let clienteIds    = Object.keys(data.analytics?.porCliente ?? {});
    if (soloActivos) {
        const hace30  = Date.now() - 30 * 24 * 60 * 60 * 1000;
        const activos = new Set(data.ventas.filter(v => v.estado !== 'cancelada' && v.timestamp >= hace30).map(v => v.clienteId));
        clienteIds = clienteIds.filter(id => activos.has(id));
    }
    if (clienteIds.length === 0) return interaction.editReply({ content: '📭 No hay clientes registrados.' });

    const embedNotif = new EmbedBuilder().setColor('#5865F2')
        .setAuthor({ name: interaction.guild.name, iconURL: interaction.guild.iconURL({ dynamic: true }) ?? undefined })
        .setTitle(titulo)
        .setThumbnail(interaction.guild.iconURL({ dynamic: true }) ?? null)
        .setDescription(`${mensaje}\n\n━━━━━━━━━━━━━━━━━━━━━━━━\n*Mensaje oficial de **${interaction.guild.name}**.*`)
        .setFooter({ text: `${interaction.guild.name} · Bot` }).setTimestamp();
    if (imagenUrl) { try { new URL(imagenUrl); embedNotif.setImage(imagenUrl); } catch {} }

    let enviados = 0, fallidos = 0;
    for (let i = 0; i < clienteIds.length; i += 2) {
        await Promise.all(clienteIds.slice(i, i + 2).map(async (id) => {
            try {
                const miembro = interaction.guild.members.cache.get(id) ?? await interaction.guild.members.fetch(id).catch(() => null);
                if (!miembro) { fallidos++; return; }
                const enviado = await withTimeout(enviarDM(miembro.user, embedNotif), 5000).catch(() => false);
                enviado ? enviados++ : fallidos++;
            } catch { fallidos++; }
        }));
        if (i + 2 < clienteIds.length) await new Promise(r => setTimeout(r, 2000));
    }

    return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#57F287')
        .setTitle(`${E.bot}  Notificación enviada`)
        .setDescription(
            `${E.arrow} ${E.check} **Enviados:** \`${enviados}\`\n` +
            `${E.arrow} ${E.cruz} **Fallidos:** \`${fallidos}\`\n` +
            `${E.arrow} ${E.person} **Total:** \`${clienteIds.length}\``
        ).setTimestamp()] });
}

// ─── Factura ──────────────────────────────────────────────────────────────────
async function handleFactura(interaction) {
    const ordenId = interaction.options.getInteger('orden');
    const data    = loadData(interaction.guild.id);
    const venta   = data.ventas.find(v => v.id === ordenId);
    if (!venta)                       return safeReply(interaction, { content: `${EX.warning} No existe la orden \`#${ordenId}\`.` });
    if (venta.estado === 'cancelada') return safeReply(interaction, { content: `${EX.warning} La orden \`#${ordenId}\` fue cancelada.` });

    const esAdmin = interaction.member.permissions.has(PermissionFlagsBits.ManageMessages);
    if (interaction.user.id !== venta.clienteId && !esAdmin)
        return safeReply(interaction, { content: '🚫 Solo el cliente o un administrador puede solicitar la factura.' });

    const resena       = data.resenas?.find(r => r.ordenId === ordenId);
    const tierCliente  = getTier(data.analytics?.porCliente?.[venta.clienteId]?.compras ?? 0, data.config.tierUmbrales);
    const totalCompras = data.analytics?.porCliente?.[venta.clienteId]?.compras ?? 0;

    const embedFactura = new EmbedBuilder().setColor('#57F287')
        .setAuthor({ name: interaction.guild.name, iconURL: interaction.guild.iconURL({ dynamic: true }) ?? undefined })
        .setTitle(`${E.invoice}  Factura — Orden \`#${ordenId}\``)
        .setDescription(
            `**${EX.document} Detalles del pedido**\n` +
            `${E.arrow} ${E.orders} **Orden #:** \`${venta.id}\`\n` +
            `${E.arrow} ${E.caja} **Producto:** \`${venta.producto}\`\n` +
            `${E.arrow} ${EX.dinero} **Monto:** \`${venta.monto ?? 'No especificado'}\`\n` +
            `${E.arrow} 💵 **Precio:** \`${venta.precio ?? 'No especificado'}\`\n` +
            `${E.arrow} ${E.tarjeta} **Método:** \`${venta.metodo}\`\n` +
            `${E.arrow} 📅 **Fecha:** \`${new Date(venta.timestamp).toLocaleString('es-MX')}\`\n\n` +
            `**${E.person} Cliente**\n` +
            `${E.arrow} <@${venta.clienteId}> — Compras: \`${totalCompras}\`\n` +
            `${E.arrow} 🎖️ **Tier:** \`${tierCliente ? `${tierCliente.emoji} ${tierCliente.label}` : 'Sin tier'}\`\n\n` +
            `**${E.hand} Operador**\n${E.arrow} <@${venta.vendedorId}> — \`${venta.vendedorTag}\`\n\n` +
            (resena ? `**${E.review} Reseña**\n${E.arrow} ${estrellas(resena.estrellas)} \`${resena.estrellas}/5\`${resena.comentario ? ` — *"${resena.comentario}"*` : ''}\n\n` : '') +
            `━━━━━━━━━━━━━━━━━━━━━━━━\n*Guarda este comprobante para consultas futuras.*`
        ).setImage(BANNER_URL).setFooter({ text: `${interaction.guild.name} · Bot · ${today()}` }).setTimestamp(venta.timestamp);

    const clienteUser = await interaction.client.users.fetch(venta.clienteId).catch(() => null);
    if (!clienteUser) return safeReply(interaction, { content: `${EX.warning} No se encontró al usuario cliente.` });
    const sent = await enviarDM(clienteUser, embedFactura);
    return safeReply(interaction, {
        content: sent
            ? `${E.check} Factura enviada por DM a <@${venta.clienteId}>.`
            : `${EX.warning} No se pudo enviar el DM. El usuario tiene los DMs desactivados.`
    });
}

// ─── Servidor stats ───────────────────────────────────────────────────────────
async function handleServidorStats(interaction) {
    const ok = await safeDefer(interaction);
    if (!ok) return;
    const data  = loadData(interaction.guild.id);
    const tdata = loadTickets(interaction.guild.id);
    const ventasActivas = data.ventas.filter(v => v.estado !== 'cancelada');
    const topV   = Object.entries(data.analytics.porVendedor ?? {}).sort((a, b) => b[1].ventas - a[1].ventas)[0];
    const topC   = Object.entries(data.analytics.porCliente  ?? {}).sort((a, b) => b[1].compras - a[1].compras)[0];
    const hoy    = ventasPorRango(ventasActivas, 'hoy');
    const semana = ventasPorRango(ventasActivas, 'semana');
    const mes    = ventasPorRango(ventasActivas, 'mes');
    const totalResenas    = data.resenas?.length ?? 0;
    const promedioResenas = totalResenas > 0 ? (data.resenas.reduce((s, r) => s + r.estrellas, 0) / totalResenas).toFixed(1) : null;
    const tierConteo = { bronce: 0, plata: 0, oro: 0, vip: 0 };
    for (const [, c] of Object.entries(data.analytics.porCliente ?? {})) {
        const t = getTier(c.compras ?? 0, data.config.tierUmbrales); if (t) tierConteo[t.nombre]++;
    }

    return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#5865F2')
        .setAuthor({ name: interaction.guild.name, iconURL: interaction.guild.iconURL({ dynamic: true }) ?? undefined })
        .setTitle(`${E.analytics}  Estadísticas del Servidor`)
        .setThumbnail(interaction.guild.iconURL({ dynamic: true }) ?? null)
        .setDescription(
            `**${E.orders} Pedidos**\n` +
            `${E.arrow} 🌅 **Hoy:** \`${hoy.length}\`\n` +
            `${E.arrow} 📅 **Esta semana:** \`${semana.length}\`\n` +
            `${E.arrow} 🗓️ **Este mes:** \`${mes.length}\`\n` +
            `${E.arrow} 📊 **Histórico:** \`${ventasActivas.length}\`\n\n` +
            `**${E.person} Comunidad**\n` +
            `${E.arrow} 🧑‍💼 **Clientes únicos:** \`${new Set(ventasActivas.map(v => v.clienteId)).size}\`\n` +
            `${E.arrow} ${E.hand} **Operadores activos:** \`${new Set(ventasActivas.map(v => v.vendedorId)).size}\`\n` +
            `${E.arrow} ${E.ticket} **Tickets cerrados:** \`${tdata.tickets.filter(t => t.estado === 'cerrado').length}\`\n` +
            (promedioResenas ? `${E.arrow} ${E.review} **Valoración:** \`${promedioResenas}/5\` *(${totalResenas} reseñas)*\n` : '') +
            `\n**🎖️ Tiers**\n` +
            `${E.line} 🥉 \`${tierConteo.bronce}\` · 🥈 \`${tierConteo.plata}\` · 🥇 \`${tierConteo.oro}\` · ${E.diamante} \`${tierConteo.vip}\`\n\n` +
            `**${EX.bluecrown} Destacados**\n` +
            `${E.arrow} ${E.corona} **Top operador:** ${topV ? `<@${topV[0]}> (\`${topV[1].ventas}\` pedidos)` : '`Sin datos`'}\n` +
            `${E.arrow} ${EX.carrito} **Top cliente:** ${topC ? `<@${topC[0]}> (\`${topC[1].compras}\` compras)` : '`Sin datos`'}`
        ).setImage(BANNER_URL).setFooter({ text: `Bot · ${today()}` }).setTimestamp()] });
}

// ─── Club VIP ─────────────────────────────────────────────────────────────────
async function handleClubVip(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageRoles))
        return safeReply(interaction, { content: '🚫 Necesitas **Gestionar roles**.' });

    const data      = loadData(interaction.guild.id);
    const vipRoleId = data.config.vipCommandRoleId;
    if (!vipRoleId)
        return safeReply(interaction, { content: `${EX.warning} Primero configura el rol VIP con \`/vip-setup\`.` });

    const cliente = interaction.options.getUser('cliente');
    const durStr  = interaction.options.getString('duracion');
    const durMs   = parseDuracion(durStr);
    if (!durMs)
        return safeReply(interaction, { content: `${EX.warning} Duración inválida. Usa: \`7d\`, \`30d\`, \`2h\`, etc.` });

    const expira   = Date.now() + durMs;
    const expiraTs = Math.floor(expira / 1000);

    // ─── FIX: obtener nombre del rol para usarlo en DMs (las menciones <@&ID> no funcionan en DMs) ───
    const rolObj    = interaction.guild.roles.cache.get(vipRoleId) ?? await interaction.guild.roles.fetch(vipRoleId).catch(() => null);
    const rolNombre = rolObj?.name ?? 'VIP';

    // Asignar rol
    try {
        const miembro = await interaction.guild.members.fetch(cliente.id).catch(() => null);
        if (!miembro) return safeReply(interaction, { content: `${EX.warning} No se encontró al usuario en el servidor.` });
        await miembro.roles.add(vipRoleId).catch(() => {});
    } catch { }

    // Guardar datos VIP
    if (!data.vipMembers) data.vipMembers = {};
    data.vipMembers[cliente.id] = {
        roleId:      vipRoleId,
        roleName:    rolNombre,
        expira,
        asignadoPor: interaction.user.id,
        asignadoTag: interaction.user.tag,
        clienteTag:  cliente.tag,
        timestamp:   Date.now()
    };
    saveData(interaction.guild.id, data);

    // Embed de confirmación en el servidor (aquí SÍ se puede usar mención de rol)
    const embedConfirmacion = new EmbedBuilder().setColor('#FEE75C')
        .setTitle(`${EX.bluecrown}  Club VIP activado`)
        .setDescription(
            `${E.arrow} ${E.person} **Usuario:** <@${cliente.id}>\n` +
            `${E.arrow} ${EX.bluecrown} **Rol:** <@&${vipRoleId}>\n` +
            `${E.arrow} ⏳ **Duración:** \`${formatDuracion(durStr)}\`\n` +
            `${E.arrow} 📅 **Expira:** <t:${expiraTs}:F>\n` +
            `${E.arrow} ${E.hand} **Asignado por:** <@${interaction.user.id}>`
        ).setFooter({ text: `Bot · ${today()}` }).setTimestamp();

    // DM al cliente — usando nombre del rol en texto, no mención
    const dmEmbed = new EmbedBuilder().setColor('#FEE75C')
        .setAuthor({ name: interaction.guild.name, iconURL: interaction.guild.iconURL({ dynamic: true }) ?? undefined })
        .setTitle(`${EX.bluecrown}  ¡Bienvenido al Club VIP!`)
        .setThumbnail(interaction.guild.iconURL({ dynamic: true }) ?? null)
        .setDescription(
            `¡Hola, **${cliente.username}**! 🎉 Tu membresía VIP ha sido activada.\n\n` +
            `${E.arrow} ${EX.bluecrown} **Rol asignado:** \`${rolNombre}\`\n` +
            `${E.arrow} ⏳ **Válido por:** \`${formatDuracion(durStr)}\`\n` +
            `${E.arrow} 📅 **Expira:** <t:${expiraTs}:F>\n\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `*Disfruta tus beneficios exclusivos en **${interaction.guild.name}**.*`
        ).setFooter({ text: `${interaction.guild.name} · Bot` }).setTimestamp();

    await enviarDM(cliente, dmEmbed);

    return safeReply(interaction, { embeds: [embedConfirmacion] });
}

async function verificarVipExpirados() {
    for (const guild of client.guilds.cache.values()) {
        if (ALLOWED_GUILDS.length > 0 && !ALLOWED_GUILDS.includes(guild.id)) continue;
        try {
            const data  = loadData(guild.id);
            if (!data.vipMembers || !Object.keys(data.vipMembers).length) continue;
            const ahora = Date.now();
            let cambio  = false;
            for (const [userId, vipInfo] of Object.entries(data.vipMembers)) {
                if (ahora < vipInfo.expira) continue;
                cambio = true;
                try {
                    const miembro = guild.members.cache.get(userId) ?? await guild.members.fetch(userId).catch(() => null);
                    if (miembro && vipInfo.roleId) await miembro.roles.remove(vipInfo.roleId).catch(() => {});

                    const user = await client.users.fetch(userId).catch(() => null);
                    if (user) {
                        // DM de expiración — usando nombre guardado del rol
                        const rolNombre = vipInfo.roleName ?? 'VIP';
                        const embedExpira = new EmbedBuilder().setColor('#ED4245')
                            .setAuthor({ name: guild.name, iconURL: guild.iconURL({ dynamic: true }) ?? undefined })
                            .setTitle(`${EX.warning}  Tu membresía VIP ha expirado`)
                            .setDescription(
                                `¡Hola, **${user.username}**!\n\n` +
                                `${E.arrow} Tu membresía **${rolNombre}** en **${guild.name}** ha llegado a su fin.\n\n` +
                                `${EX.flecha} ¿Deseas renovarla?\n` +
                                `${E.arrow} Abre un ticket de compra para continuar disfrutando de tus beneficios. 💙`
                            ).setFooter({ text: `${guild.name} · Bot` }).setTimestamp();
                        await enviarDM(user, embedExpira);
                    }
                } catch (e) { console.warn(`⚠️ VIP expirado [${userId}]:`, e?.message); }
                delete data.vipMembers[userId];
            }
            if (cambio) saveData(guild.id, data);
        } catch (e) { console.warn(`⚠️ verificarVipExpirados [${guild.name}]:`, e?.message); }
    }
}

// ─── Recordatorios de tickets ─────────────────────────────────────────────────
async function verificarRecordatorios() {
    const LIMITE_MS = 60 * 60 * 1000;
    const ahora = Date.now();
    await Promise.allSettled([...client.guilds.cache.values()].map(async guild => {
        if (ALLOWED_GUILDS.length > 0 && !ALLOWED_GUILDS.includes(guild.id)) return;
        try {
            const tdata = loadTickets(guild.id);
            if (!tdata.config.staffRoleId) return;
            const ticketsAbiertos = tdata.tickets.filter(t => t.estado === 'abierto');
            let guardado = false;
            for (const ticket of ticketsAbiertos) {
                const ultimaActividad = ticket.ultimaActividad ?? ticket.timestamp;
                if (ahora - ultimaActividad >= LIMITE_MS && !ticket.recordatorioEnviado) {
                    try {
                        const canal = guild.channels.cache.get(ticket.channelId) ?? await guild.channels.fetch(ticket.channelId).catch(() => null);
                        if (!canal) continue;
                        const cat = CATEGORIAS[ticket.categoria] ?? { label: 'Ticket' };
                        await canal.send({
                            content: `<@&${tdata.config.staffRoleId}>`,
                            embeds: [new EmbedBuilder().setColor('#ED4245')
                                .setTitle(`${E.reloj}  Ticket sin respuesta`)
                                .setDescription(
                                    `${E.arrow} **Ticket #${ticket.id}** (${cat.label} ${ticket.numero ?? ''})\n` +
                                    `${E.arrow} ${E.person} **Usuario:** <@${ticket.userId}>\n` +
                                    `${E.arrow} ⏱️ **Sin respuesta:** \`${tiempoRelativo(ahora - ultimaActividad)}\``
                                ).setTimestamp()]
                        }).catch(() => {});
                        ticket.recordatorioEnviado = true;
                        guardado = true;
                    } catch (err) { console.warn(`⚠️ Recordatorio ticket #${ticket.id}:`, err?.message); }
                }
            }
            if (guardado) saveTickets(guild.id, tdata);
        } catch (err) { console.warn(`⚠️ [recordatorio] ${guild.name}:`, err?.message); }
    }));
}

function actualizarActividadTicket(guildId, channelId) {
    try {
        const tdata  = loadTickets(guildId);
        const ticket = tdata.tickets.find(t => t.channelId === channelId && t.estado === 'abierto');
        if (!ticket) return;
        ticket.ultimaActividad     = Date.now();
        ticket.recordatorioEnviado = false;
        saveTickets(guildId, tdata);
    } catch { }
}

// ─── AFK ──────────────────────────────────────────────────────────────────────
const AFK_TIMEOUT_MS = 24 * 60 * 60 * 1000;

async function limpiarAfkExpirados() {
    for (const guild of client.guilds.cache.values()) {
        if (ALLOWED_GUILDS.length > 0 && !ALLOWED_GUILDS.includes(guild.id)) continue;
        try {
            const data  = loadData(guild.id);
            const ahora = Date.now();
            let cambio  = false;
            for (const [uid] of Object.entries(data.afk ?? {})) {
                if (ahora - data.afk[uid].tiempo > AFK_TIMEOUT_MS) { delete data.afk[uid]; cambio = true; }
            }
            if (cambio) saveData(guild.id, data);
        } catch { }
    }
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
client.rest.on('error', (err) => { if (!isIgnorableError(err)) console.warn('⚠️ [REST]', err?.message); });
client.rest.on('rateLimited', () => {});

client.once('clientReady', () => {
    console.log(`✅ Bot listo como ${client.user.tag}`);
    console.log(`📁 Datos: ${DATA_DIR}`);
    console.log(`🏠 Servidores: ${ALLOWED_GUILDS.length > 0 ? ALLOWED_GUILDS.join(', ') : 'todos'}`);
    client.user.setActivity('Club VIP 💎 | /help', { type: 3 });

    setInterval(() => {
        console.log(`💓 Keep-alive • ${new Date().toLocaleString('es-MX')} • ${client.ws.ping}ms`);
    }, 5 * 60 * 1000);

    setInterval(async () => {
        await verificarRecordatorios().catch(e => console.warn('⚠️ recordatorios:', e?.message));
        await verificarSorteos().catch(e => console.warn('⚠️ sorteos:', e?.message));
        await verificarVipExpirados().catch(e => console.warn('⚠️ vipExpirados:', e?.message));
    }, 5 * 60 * 1000);

    setInterval(limpiarAfkExpirados, 60 * 60 * 1000);
    verificarSorteos().catch(() => {});
    verificarVipExpirados().catch(() => {});
});

// ─── messageCreate ────────────────────────────────────────────────────────────
client.on('messageCreate', async (message) => {
    // Filtros base — bots, fuera de servidor, @everyone/@here
    if (message.author.bot || !message.guild) return;
    if (ALLOWED_GUILDS.length > 0 && !ALLOWED_GUILDS.includes(message.guild.id)) return;
    if (message.mentions.everyone) return;

    // ── Prefijo de texto — procesado ANTES de cualquier otra lógica ──────
    if (message.content.startsWith(PREFIX)) {
        const espera = checkCooldown(message.guild.id, message.author.id, 'prefix', 3);
        if (espera > 0) return;
        const args = message.content.slice(PREFIX.length).trim().split(/ +/);
        const cmd  = args.shift().toLowerCase();
        if (cmd === 'ping')   return message.reply(`🏓 Pong! \`${Math.round(client.ws.ping)}ms\``).catch(() => {});
        if (cmd === 'help')   return message.reply({ embeds: [buildHelpInicio(message.guild)], components: buildHelpRows() }).catch(() => {});
        if (cmd === 'reroll') {
            const sorteoId = args[0];
            if (!sorteoId) return message.reply(`${EX.warning} Uso: \`${PREFIX}reroll <id_del_sorteo>\``).catch(() => {});
            return handleReroll(message, sorteoId);
        }
        // Comando de prefix procesado — no continuar con lógica AFK/tickets
        return;
    }

    // ── Actualizar actividad del ticket (solo mensajes normales) ──────────
    actualizarActividadTicket(message.guild.id, message.channel.id);

    // ── AFK ───────────────────────────────────────────────────────────────
    try {
        const data  = loadData(message.guild.id);
        const ahora = Date.now();

        // Limpiar AFK expirados
        let limpiado = false;
        for (const [uid] of Object.entries(data.afk ?? {})) {
            if (ahora - data.afk[uid].tiempo > AFK_TIMEOUT_MS) { delete data.afk[uid]; limpiado = true; }
        }
        if (limpiado) saveData(message.guild.id, data);

        // Volver del AFK
        if (data.afk[message.author.id]) {
            const afkInfo  = data.afk[message.author.id];
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
            } catch { }

            let desc = `### ${EX.nochee}  ¡De vuelta!\n\n${E.arrow} Estuviste ausente **${duracion}**\n${E.arrow} Motivo: *${afkInfo.motivo}*\n`;
            if (menciones.length > 0) {
                desc += `\n**${E.campana} Te mencionaron ${menciones.length} vez${menciones.length > 1 ? 'es' : ''}:**\n`;
                for (const m of menciones.slice(-5)) {
                    desc += `${E.line} **${m.tag}** en <#${m.channelId}> — <t:${Math.floor(m.timestamp / 1000)}:R>\n`;
                }
            } else {
                desc += `\n${E.line} *Nadie te mencionó.*`;
            }

            await message.reply({ embeds: [new EmbedBuilder().setColor('#57F287').setDescription(desc).setFooter({ text: `Bot • AFK finalizado` }).setTimestamp()] }).catch(() => {});
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
                    tag: message.author.tag, userId: message.author.id,
                    url: message.url, channelId: message.channel.id,
                    timestamp: ahora,
                    contenido: message.content.replace(/<@!?\d+>/g, '').trim() || null
                });
                modificado = true;
                const durAFK = tiempoRelativo(ahora - afkInfo.tiempo);
                await message.reply({ embeds: [new EmbedBuilder().setColor('#ED4245')
                    .setDescription(
                        `${E.arrow} 💤 **${usuario.username}** está AFK hace **${durAFK}**\n` +
                        `${E.line} Motivo: *${afkInfo.motivo}*`
                    ).setFooter({ text: `Bot • AFK` }).setTimestamp()] }).catch(() => {});
            }
            if (modificado) saveData(message.guild.id, data);
        }

        // Mención directa al bot
        if (message.mentions.has(client.user) && !message.mentions.everyone) {
            await message.reply({ embeds: [new EmbedBuilder().setColor('#5865F2')
                .setDescription(`### ${E.bot}  ¡Hola!\n\n${E.arrow} Usa \`/help\` para ver mis comandos.\n${E.arrow} Prefijo de texto: \`${PREFIX}\``)] }).catch(() => {});
        }
    } catch (e) { if (!isIgnorableError(e)) console.warn('⚠️ messageCreate:', e?.message); }
});

// ─── interactionCreate ────────────────────────────────────────────────────────
client.on('interactionCreate', async (interaction) => {
    try {
        if (!interaction.guild) return;
        if (ALLOWED_GUILDS.length > 0 && !ALLOWED_GUILDS.includes(interaction.guild.id)) return;

        // ── Tickets ───────────────────────────────────────────────────────
        if (
            (interaction.isStringSelectMenu() && interaction.customId === 'ticket_categoria') ||
            (interaction.isModalSubmit()       && interaction.customId.startsWith('ticket_modal_')) ||
            (interaction.isButton()            && (
                interaction.customId.startsWith('ticket_cerrar_')         ||
                interaction.customId.startsWith('ticket_reclamar_')       ||
                interaction.customId.startsWith('ticket_confirm_cerrar_') ||
                interaction.customId.startsWith('ticket_reabrir_')        ||
                interaction.customId.startsWith('ticket_cancelar_cierre_')
            ))
        ) {
            // return explícito — evita que el flujo caiga en el bloque de slash commands
            return safeHandle(interaction, () => handleTicketInteraction(interaction));
        }

        // ── Sorteos ───────────────────────────────────────────────────────
        if (interaction.isButton() && interaction.customId.startsWith('sorteo_participar_')) {
            return safeHandle(interaction, () => handleSorteoParticipar(interaction, interaction.customId.replace('sorteo_participar_', '')));
        }
        if (interaction.isButton() && interaction.customId.startsWith('sorteo_finalizar_')) {
            return safeHandle(interaction, () => handleSorteoFinalizar(interaction, interaction.customId.replace('sorteo_finalizar_', '')));
        }

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
                const data    = loadData(interaction.guild.id);
                const venta   = data.ventas.find(v => v.id === ordenId);
                if (!venta || venta.estado === 'cancelada')
                    return interaction.update({ content: `${EX.warning} Esta orden ya fue procesada.`, embeds: [], components: [] });

                venta.estado = 'cancelada';
                if (data.resenas) data.resenas = data.resenas.filter(r => r.ordenId !== ordenId);
                data.analytics.totalVentas = Math.max(0, data.analytics.totalVentas - 1);
                if (data.analytics.porVendedor[venta.vendedorId])
                    data.analytics.porVendedor[venta.vendedorId].ventas = Math.max(0, (data.analytics.porVendedor[venta.vendedorId].ventas ?? 1) - 1);
                if (data.analytics.porCliente?.[venta.clienteId])
                    data.analytics.porCliente[venta.clienteId].compras = Math.max(0, (data.analytics.porCliente[venta.clienteId].compras ?? 1) - 1);
                saveData(interaction.guild.id, data);
                await actualizarTier(interaction.guild, venta.clienteId, data.analytics.porCliente?.[venta.clienteId]?.compras ?? 0, data.config.tierRoles, data.config.tierUmbrales);

                return interaction.update({ embeds: [new EmbedBuilder().setColor('#ED4245')
                    .setTitle(`${E.cruz}  Orden cancelada`)
                    .setDescription(
                        `${E.arrow} ${E.orders} **Orden:** \`#${ordenId}\`\n` +
                        `${E.arrow} ${E.caja} **Producto:** \`${venta.producto}\`\n` +
                        `${E.arrow} ${E.person} **Cliente:** <@${venta.clienteId}>\n` +
                        `${E.arrow} 🔨 **Por:** <@${interaction.user.id}>`
                    ).setTimestamp()], components: [] });
            });
        }
        if (interaction.isButton() && interaction.customId.startsWith('cancelar_abort_')) {
            return interaction.update({ content: `${E.check} Cancelación abortada.`, embeds: [], components: [] }).catch(() => {});
        }

        // ── Reseña (botón) ────────────────────────────────────────────────
        if (interaction.isButton() && interaction.customId.startsWith('reseña_')) {
            return safeHandle(interaction, async () => {
                const ordenId = parseInt(interaction.customId.split('_')[1]);
                const data    = loadData(interaction.guild.id);
                const venta   = data.ventas.find(v => v.id === ordenId);
                if (!venta || interaction.user.id !== venta.clienteId)
                    return safeReply(interaction, { content: `${EX.warning} Solo el cliente puede dejar reseña.` });
                if (data.resenas.find(r => r.ordenId === ordenId))
                    return safeReply(interaction, { content: `${EX.warning} Ya dejaste una reseña para esta orden.` });
                return mostrarModalResena(interaction, ordenId);
            });
        }

        // ── Reseña (modal submit) ─────────────────────────────────────────
        if (interaction.isModalSubmit() && interaction.customId.startsWith('modal_resena_')) {
            return safeHandle(interaction, async () => {
                const ordenId      = parseInt(interaction.customId.split('_')[2]);
                const data         = loadData(interaction.guild.id);
                const venta        = data.ventas.find(v => v.id === ordenId);
                if (!venta) return safeReply(interaction, { content: `${EX.warning} Orden no encontrada.` });
                const numEstrellas = parseInt(interaction.fields.getTextInputValue('estrellas'));
                const comentario   = interaction.fields.getTextInputValue('comentario') || null;
                const imagenUrl    = interaction.fields.getTextInputValue('imagen_url') || null;
                if (isNaN(numEstrellas) || numEstrellas < 1 || numEstrellas > 5)
                    return safeReply(interaction, { content: `${EX.warning} Calificación del 1 al 5.` });
                let imagenValida = null;
                if (imagenUrl) { try { new URL(imagenUrl); imagenValida = imagenUrl; } catch { } }
                if (!data.resenas) data.resenas = [];
                data.resenas.push({
                    ordenId, clienteId: venta.clienteId, clienteTag: venta.clienteTag,
                    vendedorId: venta.vendedorId, estrellas: numEstrellas,
                    comentario, imagen: imagenValida, timestamp: Date.now()
                });
                saveData(interaction.guild.id, data);

                const embedResena = new EmbedBuilder().setColor('#FEE75C')
                    .setTitle(`${E.review}  Reseña — Orden \`#${ordenId}\``)
                    .setDescription(
                        `${E.arrow} ${E.person} **Cliente:** <@${venta.clienteId}>\n` +
                        `${E.arrow} ${E.hand} **Operador:** <@${venta.vendedorId}>\n` +
                        `${E.arrow} ${estrellas(numEstrellas)} \`${numEstrellas}/5\`` +
                        (comentario ? `\n\n${E.line} *"${comentario}"*` : '') +
                        (imagenValida ? `\n${E.line} 📸 *Imagen adjunta*` : '')
                    ).setTimestamp();
                if (imagenValida) embedResena.setImage(imagenValida);
                await safeReply(interaction, { content: `${E.check} ¡Gracias por tu reseña!`, embeds: [embedResena] });
                if (data.config.resenaChannelId) {
                    const canal = interaction.guild.channels.cache.get(data.config.resenaChannelId);
                    if (canal) await canal.send({ embeds: [embedResena] }).catch(() => {});
                }
            });
        }

        // ─── Solo slash commands a partir de aquí ─────────────────────────
        if (!interaction.isChatInputCommand()) return;

        // ─── Slash commands ───────────────────────────────────────────────
        return safeHandle(interaction, async () => {
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
            if (interaction.commandName === 'clubvip')        return handleClubVip(interaction);

            // ── vip-setup ─────────────────────────────────────────────────
            if (interaction.commandName === 'vip-setup') {
                if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator))
                    return safeReply(interaction, { content: '🚫 Solo administradores.' });
                const rol = interaction.options.getRole('rol');
                data.config.vipCommandRoleId = rol.id;
                saveData(guild.id, data);
                return safeReply(interaction, { embeds: [new EmbedBuilder().setColor('#FEE75C')
                    .setTitle(`${EX.bluecrown}  Club VIP configurado`)
                    .setDescription(
                        `${E.arrow} ${EX.bluecrown} **Rol VIP:** <@&${rol.id}>\n` +
                        `${E.line} *Ahora puedes usar \`/clubvip\` para asignar membresías.*`
                    ).setTimestamp()] });
            }

            // ── setvip ────────────────────────────────────────────────────
            if (interaction.commandName === 'setvip') {
                if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator))
                    return safeReply(interaction, { content: '🚫 Solo administradores.' });
                const rol = interaction.options.getRole('rol');
                data.config.vipRoleId = rol.id;
                saveData(guild.id, data);
                return safeReply(interaction, { embeds: [new EmbedBuilder().setColor('#FEE75C')
                    .setTitle(`${EX.bluecrown}  Rol VIP (sorteos) configurado`)
                    .setDescription(`${E.arrow} ${E.diamante} **Rol VIP:** <@&${rol.id}>`)
                    .setTimestamp()] });
            }

            // ── settiers ──────────────────────────────────────────────────
            if (interaction.commandName === 'settiers') {
                if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator))
                    return safeReply(interaction, { content: '🚫 Solo administradores.' });
                const rolBronce    = interaction.options.getRole('bronce');
                const rolPlata     = interaction.options.getRole('plata');
                const rolOro       = interaction.options.getRole('oro');
                const rolVip       = interaction.options.getRole('vip');
                const umbralBronce = interaction.options.getInteger('umbral_bronce');
                const umbralPlata  = interaction.options.getInteger('umbral_plata');
                const umbralOro    = interaction.options.getInteger('umbral_oro');
                const umbralVip    = interaction.options.getInteger('umbral_vip');

                if (!data.config.tierRoles)    data.config.tierRoles    = {};
                if (!data.config.tierUmbrales) data.config.tierUmbrales = {};

                if (rolBronce) data.config.tierRoles.bronce = rolBronce.id;
                if (rolPlata)  data.config.tierRoles.plata  = rolPlata.id;
                if (rolOro)    data.config.tierRoles.oro    = rolOro.id;
                if (rolVip)    data.config.tierRoles.vip    = rolVip.id;

                if (umbralBronce != null) data.config.tierUmbrales.bronce = umbralBronce;
                if (umbralPlata  != null) data.config.tierUmbrales.plata  = umbralPlata;
                if (umbralOro    != null) data.config.tierUmbrales.oro    = umbralOro;
                if (umbralVip    != null) data.config.tierUmbrales.vip    = umbralVip;

                const sinCambios = !rolBronce && !rolPlata && !rolOro && !rolVip
                    && umbralBronce == null && umbralPlata == null && umbralOro == null && umbralVip == null;
                if (!sinCambios) saveData(guild.id, data);

                const tr = data.config.tierRoles;
                const tu = data.config.tierUmbrales;
                return safeReply(interaction, { embeds: [new EmbedBuilder().setColor('#FEE75C')
                    .setTitle(`${E.roles}  Tiers de compras`)
                    .setDescription(
                        `${sinCambios ? `${E.line} *Configuración actual.*\n\n` : ''}` +
                        `${E.arrow} 🥉 **Bronce** *(${tu.bronce ?? 1}+ compras)* → ${tr.bronce ? `<@&${tr.bronce}>` : '`Sin configurar`'}\n` +
                        `${E.arrow} 🥈 **Plata** *(${tu.plata  ?? 5}+ compras)* → ${tr.plata  ? `<@&${tr.plata}>`  : '`Sin configurar`'}\n` +
                        `${E.arrow} 🥇 **Oro** *(${tu.oro    ?? 10}+ compras)* → ${tr.oro    ? `<@&${tr.oro}>`    : '`Sin configurar`'}\n` +
                        `${E.arrow} ${E.diamante} **VIP** *(${tu.vip ?? 20}+ compras)* → ${tr.vip ? `<@&${tr.vip}>` : '`Sin configurar`'}`
                    ).setFooter({ text: sinCambios ? 'Sin cambios' : `${E.check} Guardado` }).setTimestamp()] });
            }

            // ── vender ────────────────────────────────────────────────────
            if (interaction.commandName === 'vender') {
                const espera = checkCooldown(guild.id, user.id, 'vender', 10);
                if (espera > 0) return safeReply(interaction, { content: `${E.relojArena} Espera **${espera}s**.` });
                const producto = interaction.options.getString('producto');
                const clienteU = interaction.options.getUser('cliente');
                const vendedor = interaction.options.getUser('vendedor');
                const monto    = interaction.options.getString('monto')   ?? null;
                const precio   = interaction.options.getString('precio')  ?? null;
                const metodo   = interaction.options.getString('metodo')  ?? 'No especificado';
                const notas    = interaction.options.getString('notas')   ?? null;

                const n = nextVentaId(data.ventas);
                const venta = {
                    id: n, producto,
                    clienteId: clienteU.id, clienteTag: clienteU.tag,
                    vendedorId: vendedor.id, vendedorTag: vendedor.tag,
                    monto, precio, metodo, notas,
                    timestamp: Date.now(), estado: 'completada'
                };
                data.ventas.push(venta);
                data.analytics.totalVentas++;
                if (!data.analytics.porVendedor[vendedor.id]) data.analytics.porVendedor[vendedor.id] = { ventas: 0, tag: vendedor.tag };
                data.analytics.porVendedor[vendedor.id].ventas++;
                data.analytics.porVendedor[vendedor.id].tag = vendedor.tag;
                if (!data.analytics.porCliente[clienteU.id]) data.analytics.porCliente[clienteU.id] = { compras: 0, tag: clienteU.tag };
                data.analytics.porCliente[clienteU.id].compras++;
                data.analytics.porCliente[clienteU.id].tag = clienteU.tag;
                saveData(guild.id, data);
                await actualizarTier(guild, clienteU.id, data.analytics.porCliente[clienteU.id].compras, data.config.tierRoles, data.config.tierUmbrales);

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
                        .setTitle(`${EX.bluecrown}  ¡Hito alcanzado!`)
                        .setDescription(`${E.arrow} **${guild.name}** alcanzó **${data.analytics.totalVentas}** pedidos.`)
                        .setTimestamp()] }).catch(() => {});
                }
                return;
            }

            // ── orden ─────────────────────────────────────────────────────
            if (interaction.commandName === 'orden') {
                const venta = data.ventas.find(v => v.id === interaction.options.getInteger('id'));
                if (!venta) return safeReply(interaction, { content: `${EX.warning} No existe esa orden.` });
                const resena = data.resenas?.find(r => r.ordenId === venta.id);
                return safeReply(interaction, { embeds: [new EmbedBuilder()
                    .setColor(venta.estado === 'cancelada' ? '#ED4245' : '#5865F2')
                    .setTitle(`${venta.estado === 'cancelada' ? E.cruz : E.check}  Orden \`#${venta.id}\``)
                    .setDescription(
                        `${E.arrow} ${E.caja} **Producto:** \`${venta.producto}\`\n` +
                        `${E.arrow} ${EX.dinero} **Monto:** \`${venta.monto ?? 'No especificado'}\`\n` +
                        `${E.arrow} 💵 **Precio:** \`${venta.precio ?? 'No especificado'}\`\n` +
                        `${E.arrow} ${E.tarjeta} **Método:** \`${venta.metodo}\`\n` +
                        (venta.notas ? `${E.arrow} 📝 **Notas:** \`${venta.notas}\`\n` : '') +
                        `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                        `${E.arrow} ${E.person} **Cliente:** <@${venta.clienteId}>\n` +
                        `${E.arrow} ${E.hand} **Operador:** <@${venta.vendedorId}>\n\n` +
                        `**${E.review} Reseña:** ${resena ? `${estrellas(resena.estrellas)} \`${resena.estrellas}/5\`` + (resena.comentario ? ` — *"${resena.comentario}"*` : '') : '*Sin reseña aún*'}`
                    ).setFooter({ text: `Estado: ${venta.estado}` }).setTimestamp(venta.timestamp)] });
            }

            // ── buscar ────────────────────────────────────────────────────
            if (interaction.commandName === 'buscar') {
                const objetivo = interaction.options.getUser('cliente');
                const ventas   = data.ventas.filter(v => v.clienteId === objetivo.id && v.estado !== 'cancelada');
                if (ventas.length === 0) return safeReply(interaction, { content: `📭 **${objetivo.username}** no tiene pedidos.` });
                const ultimas  = ventas.slice(-8).reverse();
                const tierCli  = getTier(data.analytics.porCliente?.[objetivo.id]?.compras ?? 0, data.config.tierUmbrales);
                return safeReply(interaction, { embeds: [new EmbedBuilder().setColor('#5865F2')
                    .setTitle(`${E.person}  Historial de ${objetivo.username}`)
                    .setThumbnail(objetivo.displayAvatarURL({ dynamic: true }))
                    .setDescription(
                        `${E.arrow} ${EX.carrito} **Pedidos:** \`${ventas.length}\`\n` +
                        (tierCli ? `${E.arrow} 🎖️ **Tier:** \`${tierCli.emoji} ${tierCli.label}\`\n` : '') +
                        `\n**Últimos pedidos:**\n` +
                        ultimas.map(v => `${E.line} \`#${v.id}\` **${v.producto}** — <t:${Math.floor(v.timestamp / 1000)}:d>`).join('\n')
                    ).setFooter({ text: `Mostrando ${ultimas.length} de ${ventas.length}` }).setTimestamp()] });
            }

            // ── historial ─────────────────────────────────────────────────
            if (interaction.commandName === 'historial') {
                const rango   = interaction.options.getString('rango') ?? 'todo';
                const filtroU = interaction.options.getUser('usuario');
                let ventas = rango === 'todo' ? data.ventas : ventasPorRango(data.ventas, rango);
                if (filtroU) ventas = ventas.filter(v => v.clienteId === filtroU.id || v.vendedorId === filtroU.id);
                if (ventas.length === 0) return safeReply(interaction, { content: '📭 No hay pedidos con ese filtro.' });
                const ultimas = ventas.slice(-10).reverse();
                return safeReply(interaction, { embeds: [new EmbedBuilder().setColor('#5865F2')
                    .setTitle(`${E.orders}  Historial — ${guild.name}`)
                    .setDescription(
                        ultimas.map(v => {
                            const t = v.estado === 'cancelada' ? '~~' : '';
                            return `${E.line} \`#${v.id}\` ${t}**${v.producto}**${t} — <@${v.clienteId}>`;
                        }).join('\n') +
                        `\n\n${E.arrow} 🧾 **Total:** \`${ventas.length}\``
                    ).setFooter({ text: `Últimos ${ultimas.length} de ${ventas.length}` }).setTimestamp()] });
            }

            // ── reseña ────────────────────────────────────────────────────
            if (interaction.commandName === 'reseña') {
                const ordenId = interaction.options.getInteger('orden');
                const venta   = data.ventas.find(v => v.id === ordenId);
                if (!venta) return safeReply(interaction, { content: `${EX.warning} No existe la orden \`#${ordenId}\`.` });
                if (venta.clienteId !== user.id) return safeReply(interaction, { content: `${EX.warning} Solo el cliente puede dejar reseña.` });
                if (data.resenas?.find(r => r.ordenId === ordenId)) return safeReply(interaction, { content: `${EX.warning} Ya dejaste una reseña.` });
                return mostrarModalResena(interaction, ordenId);
            }

            // ── resenas ───────────────────────────────────────────────────
            if (interaction.commandName === 'resenas') {
                const objetivo = interaction.options.getUser('vendedor');
                const resenas  = data.resenas?.filter(r => r.vendedorId === objetivo.id) ?? [];
                if (resenas.length === 0) return safeReply(interaction, { content: `📭 **${objetivo.username}** no tiene reseñas.` });
                const promedio = (resenas.reduce((s, r) => s + r.estrellas, 0) / resenas.length).toFixed(1);
                return safeReply(interaction, { embeds: [new EmbedBuilder().setColor('#FEE75C')
                    .setTitle(`${E.review}  Reseñas de ${objetivo.username}`)
                    .setThumbnail(objetivo.displayAvatarURL({ dynamic: true }))
                    .setDescription(
                        `${E.arrow} **Promedio:** \`${promedio}/5\` *(${resenas.length} reseña${resenas.length !== 1 ? 's' : ''})*\n\n` +
                        resenas.slice(-5).reverse().map(r =>
                            `${E.line} ${estrellas(r.estrellas)} <@${r.clienteId}>` +
                            (r.comentario ? ` — *"${r.comentario}"*` : '')
                        ).join('\n')
                    ).setFooter({ text: `Últimas ${Math.min(5, resenas.length)} de ${resenas.length}` }).setTimestamp()] });
            }

            // ── cancelar ──────────────────────────────────────────────────
            if (interaction.commandName === 'cancelar') {
                if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages))
                    return safeReply(interaction, { content: '🚫 Necesitas **Gestionar mensajes**.' });
                const ordenId = interaction.options.getInteger('orden');
                const venta   = data.ventas.find(v => v.id === ordenId);
                if (!venta) return safeReply(interaction, { content: `${EX.warning} No existe la orden \`#${ordenId}\`.` });
                if (venta.estado === 'cancelada') return safeReply(interaction, { content: `${EX.warning} Ya está cancelada.` });
                return safeReply(interaction, {
                    embeds: [new EmbedBuilder().setColor('#ED4245')
                        .setTitle(`${EX.alert}  ¿Cancelar orden \`#${ordenId}\`?`)
                        .setDescription(
                            `${E.arrow} ${E.caja} **Producto:** \`${venta.producto}\`\n` +
                            `${E.arrow} ${E.person} **Cliente:** <@${venta.clienteId}>\n\n` +
                            `*Esta acción **no se puede deshacer**.*`
                        )],
                    components: [new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId(`cancelar_confirm_${ordenId}`).setLabel('Sí, cancelar').setStyle(ButtonStyle.Danger),
                        new ButtonBuilder().setCustomId(`cancelar_abort_${ordenId}`).setLabel('No, mantener').setStyle(ButtonStyle.Secondary)
                    )]
                });
            }

            // ── exportar ──────────────────────────────────────────────────
            if (interaction.commandName === 'exportar') {
                if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages))
                    return safeReply(interaction, { content: '🚫 Necesitas **Gestionar mensajes**.' });
                const rango  = interaction.options.getString('rango') ?? 'mes';
                const ventas = ventasPorRango(data.ventas, rango).filter(v => v.estado !== 'cancelada');
                if (ventas.length === 0) return safeReply(interaction, { content: '📭 No hay pedidos en ese período.' });
                const etiquetas = { hoy: 'Hoy', semana: 'Esta semana', mes: 'Este mes' };
                const lineas = [`REPORTE — ${etiquetas[rango] ?? rango}`, `Servidor: ${guild.name}`, `Generado: ${new Date().toLocaleString('es-MX')}`, '─'.repeat(60), ''];
                ventas.forEach(v => lineas.push(`#${v.id} | ${v.producto} | ${v.monto ?? '-'} | ${v.precio ?? '-'} | ${v.metodo} | Cliente: ${v.clienteTag} | Operador: ${v.vendedorTag}`));
                lineas.push('', '─'.repeat(60), `TOTAL: ${ventas.length} pedidos`);
                return interaction.reply({
                    content: `${E.export} **${ventas.length}** pedidos exportados:`,
                    files: [{ attachment: Buffer.from(lineas.join('\n'), 'utf8'), name: `pedidos-${rango}.txt` }],
                    flags: 64
                });
            }

            // ── perfil ────────────────────────────────────────────────────
            if (interaction.commandName === 'perfil') {
                const objetivo     = interaction.options.getUser('usuario');
                const comoVendedor = data.ventas.filter(v => v.vendedorId === objetivo.id && v.estado !== 'cancelada');
                const comoCliente  = data.ventas.filter(v => v.clienteId  === objetivo.id && v.estado !== 'cancelada');
                const resenas      = data.resenas?.filter(r => r.vendedorId === objetivo.id) ?? [];
                const promedio     = resenas.length > 0 ? `${(resenas.reduce((s, r) => s + r.estrellas, 0) / resenas.length).toFixed(1)}/5` : 'Sin reseñas';
                const tierCli      = getTier(data.analytics.porCliente?.[objetivo.id]?.compras ?? 0, data.config.tierUmbrales);
                const miembroObj   = guild.members.cache.get(objetivo.id);
                const esVip        = esClienteVip(miembroObj, data.config?.vipRoleId ?? null);
                return safeReply(interaction, { embeds: [new EmbedBuilder().setColor('#5865F2')
                    .setTitle(`${E.person}  ${objetivo.username}${esVip ? `  ${EX.bluecrown} VIP` : ''}`)
                    .setThumbnail(objetivo.displayAvatarURL({ dynamic: true }))
                    .setDescription(
                        `**${E.hand} Como operador**\n` +
                        `${E.arrow} 🧾 **Pedidos:** \`${comoVendedor.length}\`\n` +
                        `${E.arrow} ${E.review} **Valoración:** \`${promedio}\`\n\n` +
                        `**${EX.carrito} Como cliente**\n` +
                        `${E.arrow} ${EX.carrito} **Compras:** \`${comoCliente.length}\`\n` +
                        `${E.arrow} 🎖️ **Tier:** \`${tierCli ? `${tierCli.emoji} ${tierCli.label}` : 'Sin tier'}\``
                    ).setFooter({ text: guild.name }).setTimestamp()] });
            }

            // ── stats ─────────────────────────────────────────────────────
            if (interaction.commandName === 'stats') {
                const rango  = interaction.options.getString('rango') ?? 'hoy';
                const ventas = ventasPorRango(data.ventas, rango).filter(v => v.estado !== 'cancelada');
                const etiquetas = { hoy: 'Hoy', semana: 'Esta semana', mes: 'Este mes' };
                return safeReply(interaction, { embeds: [new EmbedBuilder().setColor('#FEE75C')
                    .setTitle(`${E.stats}  Stats — ${etiquetas[rango] ?? rango}`)
                    .setDescription(
                        `${E.arrow} 🧾 **Pedidos:** \`${ventas.length}\`\n` +
                        `${E.arrow} ${E.person} **Clientes únicos:** \`${new Set(ventas.map(v => v.clienteId)).size}\`\n\n` +
                        `${E.line} 📦 **Total histórico:** \`${data.ventas.filter(v => v.estado !== 'cancelada').length}\``
                    ).setFooter({ text: guild.name }).setTimestamp()] });
            }

            // ── top ───────────────────────────────────────────────────────
            if (interaction.commandName === 'top') {
                const tipo     = interaction.options.getString('tipo') ?? 'vendedores';
                const medallas = ['🥇', '🥈', '🥉'];
                if (tipo === 'compradores') {
                    const lista = Object.entries(data.analytics.porCliente ?? {})
                        .map(([id, d]) => ({ id, ...d })).filter(c => c.compras > 0)
                        .sort((a, b) => b.compras - a.compras).slice(0, 10);
                    if (lista.length === 0) return safeReply(interaction, { content: '📭 Sin compras aún.' });
                    return safeReply(interaction, { embeds: [new EmbedBuilder().setColor('#FEE75C')
                        .setTitle(`${EX.bluecrown}  Top compradores`)
                        .setDescription(lista.map((c, i) => `> ${medallas[i] ?? `**${i + 1}.**`} <@${c.id}> — \`${c.compras}\` compra(s)`).join('\n')).setTimestamp()] });
                }
                const lista = Object.entries(data.analytics.porVendedor)
                    .map(([id, d]) => ({ id, ...d })).filter(v => v.ventas > 0)
                    .sort((a, b) => b.ventas - a.ventas).slice(0, 10);
                if (lista.length === 0) return safeReply(interaction, { content: '📭 Sin pedidos aún.' });
                return safeReply(interaction, { embeds: [new EmbedBuilder().setColor('#57F287')
                    .setTitle(`${EX.bluecrown}  Top operadores`)
                    .setDescription(lista.map((v, i) => `> ${medallas[i] ?? `**${i + 1}.**`} <@${v.id}> — \`${v.ventas}\` pedido(s)`).join('\n')).setTimestamp()] });
            }

            // ── dashboard ─────────────────────────────────────────────────
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
                        `${E.arrow} 🌅 **Hoy:** \`${hoy.length}\` pedidos\n` +
                        `${E.arrow} 📅 **Esta semana:** \`${semana.length}\` pedidos\n` +
                        `${E.arrow} 🗓️ **Este mes:** \`${mes.length}\` pedidos\n` +
                        `${E.arrow} 📦 **Histórico:** \`${data.analytics.totalVentas}\` pedidos\n\n` +
                        `${E.arrow} ${EX.bluecrown} **Top operador:** ${topV ? `<@${topV[0]}> (\`${topV[1].ventas}\` pedidos)` : '`Sin datos`'}\n` +
                        `${E.arrow} ${E.corona} **Top cliente:** ${topC ? `<@${topC[0]}> (\`${topC[1].compras}\` compras)` : '`Sin datos`'}` +
                        (prom ? `\n${E.arrow} ${E.review} **Valoración:** \`${prom}/5\` *(${totalR} reseñas)*` : '')
                    ).setFooter({ text: `Bot` }).setTimestamp()] });
            }

            // ── afk ───────────────────────────────────────────────────────
            if (interaction.commandName === 'afk') {
                const motivo = interaction.options.getString('motivo') ?? 'Sin motivo';
                data.afk[user.id] = { motivo, tiempo: Date.now(), menciones: [] };
                saveData(guild.id, data);
                try {
                    const miembro = guild.members.cache.get(user.id);
                    if (miembro && guild.members.me.permissions.has(PermissionFlagsBits.ManageNicknames)) {
                        const nickActual = miembro.nickname ?? miembro.user.username;
                        const nickLimpio = nickActual.startsWith('[AFK] ') ? nickActual.replace('[AFK] ', '') : nickActual;
                        await miembro.setNickname(`[AFK] ${nickLimpio.slice(0, 25)}`).catch(() => {});
                    }
                } catch { }
                return safeReplyPublic(interaction, { embeds: [new EmbedBuilder().setColor('#3498DB')
                    .setTitle(`${EX.nochee}  AFK activado`)
                    .setDescription(
                        `${E.arrow} 💤 **${user.username}** está en modo AFK\n` +
                        `${E.arrow} 📝 **Motivo:** *${motivo}*\n` +
                        `${E.arrow} ${E.reloj} **Desde:** <t:${Math.floor(Date.now() / 1000)}:R>\n\n` +
                        `${E.line} *Escribe cualquier mensaje para volver.*`
                    ).setThumbnail(user.displayAvatarURL({ dynamic: true }))
                    .setFooter({ text: `Bot • AFK` }).setTimestamp()] });
            }

            // ── anuncio ───────────────────────────────────────────────────
            if (interaction.commandName === 'anuncio') {
                if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages))
                    return safeReply(interaction, { content: '🚫 Necesitas **Gestionar mensajes**.' });
                const imagenUrl = interaction.options.getString('imagen') ?? null;
                const embed = new EmbedBuilder().setColor('#ED4245')
                    .setTitle(`${EX.alert}  ${interaction.options.getString('titulo')}`)
                    .setDescription(interaction.options.getString('mensaje'))
                    .setFooter({ text: `Anuncio por ${user.tag} · Bot` }).setTimestamp();
                if (imagenUrl) { try { new URL(imagenUrl); embed.setImage(imagenUrl); } catch {} }
                const opts = { embeds: [embed] };
                const textoBoton  = interaction.options.getString('texto_boton');
                const enlaceBoton = interaction.options.getString('enlace_boton');
                if (textoBoton && enlaceBoton) {
                    opts.components = [new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setLabel(textoBoton).setURL(enlaceBoton).setStyle(ButtonStyle.Link)
                    )];
                }
                await safeReply(interaction, { content: `${E.check} Anuncio enviado.` });
                return interaction.channel.send(opts).catch(() => {});
            }

            // ── clear ─────────────────────────────────────────────────────
            if (interaction.commandName === 'clear') {
                if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages))
                    return safeReply(interaction, { content: '🚫 Necesitas **Gestionar mensajes**.' });
                const cantidad = interaction.options.getInteger('cantidad');
                if (cantidad < 1 || cantidad > 100) return safeReply(interaction, { content: `${EX.warning} Entre 1 y 100.` });
                const ok = await safeDefer(interaction, true);
                if (!ok) return;
                const deleted = await interaction.channel.bulkDelete(cantidad, true).catch(e => {
                    if (e.code === 50034) interaction.editReply({ content: `${EX.warning} No se pueden borrar mensajes con más de **14 días**.` });
                    else interaction.editReply({ content: `${EX.warning} Error al borrar: \`${e.message}\`` });
                    return null;
                });
                if (deleted) return interaction.editReply({ content: `🗑️ **${deleted.size}** mensaje(s) eliminados.` });
                return;
            }

            // ── setlog ────────────────────────────────────────────────────
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
                data.config.dmCierreTexto = interaction.options.getString('texto');
                saveData(guild.id, data);
                return safeReply(interaction, { embeds: [new EmbedBuilder().setColor('#57F287')
                    .setTitle(`${E.settings}  Mensaje de cierre actualizado`)
                    .setDescription(`${E.line} ${data.config.dmCierreTexto}\n\n*Variables: \`{usuario}\` \`{servidor}\`*`)] });
            }
        });

    } catch (e) { if (!isIgnorableError(e)) console.error('❌ interactionCreate:', e?.message); }
});

// ─── Helper: modal de reseña ──────────────────────────────────────────────────
function mostrarModalResena(interaction, ordenId) {
    const modal = new ModalBuilder().setCustomId(`modal_resena_${ordenId}`).setTitle(`⭐ Reseña — Orden #${ordenId}`);
    modal.addComponents(
        new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('estrellas').setLabel('Calificación (1 a 5 ⭐)')
                .setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(1).setPlaceholder('1 – 5')
        ),
        new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('comentario').setLabel('Comentario (opcional)')
                .setStyle(TextInputStyle.Paragraph).setRequired(false).setMaxLength(300)
                .setPlaceholder('Cuéntanos tu experiencia...')
        ),
        new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('imagen_url').setLabel('URL de imagen (opcional)')
                .setStyle(TextInputStyle.Short).setRequired(false).setPlaceholder('https://imgur.com/...')
        )
    );
    return interaction.showModal(modal).catch(() => {});
}

// ─── Login ────────────────────────────────────────────────────────────────────
client.login(process.env.TOKEN).catch(err => {
    console.error('❌ FATAL: No se pudo conectar:', err.message);
    process.exit(1);
});