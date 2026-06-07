const {
    Client,
    GatewayIntentBits,
    EmbedBuilder,
    PermissionFlagsBits,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    ChannelType
} = require('discord.js');
const fs   = require('fs');
const path = require('path');
require('dotenv').config();

// ─────────────────────────────────────────────
//  BANNER
// ─────────────────────────────────────────────
const BANNER_URL = 'https://i.imgur.com/REEMPLAZA.png';

// ─────────────────────────────────────────────
//  TIERS
// ─────────────────────────────────────────────
const TIER_UMBRALES = [
    { nombre: 'bronce', minCompras: 1  },
    { nombre: 'plata',  minCompras: 5  },
    { nombre: 'oro',    minCompras: 10 },
    { nombre: 'vip',    minCompras: 20 }
];

// ─────────────────────────────────────────────
//  PERSISTENCIA + CACHÉ
// ─────────────────────────────────────────────
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
        config: { logChannelId: null, dmEnabled: true, resenaChannelId: null, dmCierreTexto: null, tierRoles: {} },
        afk: {}, stock: [],
        analytics: { totalVentas: 0, totalRobux: 0, porVendedor: {}, porCliente: {} }
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

// ─────────────────────────────────────────────
//  MANEJO GLOBAL DE ERRORES
//  Estos 3 handlers evitan que el bot caiga
//  por cualquier error no capturado
// ─────────────────────────────────────────────
process.on('unhandledRejection', (error) => {
    // Ignorar silenciosamente Unknown interaction (10062) — es inofensivo
    if (error?.code === 10062) return;
    console.error('❌ [unhandledRejection]', error?.message ?? error);
});
process.on('uncaughtException', (error) => {
    // Ignorar Unknown interaction que escape por throw
    if (error?.code === 10062 || error?.message?.includes('Unknown interaction')) return;
    console.error('❌ [uncaughtException]', error?.message ?? error);
    // NO hacer process.exit() — el bot sigue vivo
});
process.on('uncaughtExceptionMonitor', (error) => {
    if (error?.code === 10062) return;
    console.error('❌ [uncaughtExceptionMonitor]', error?.message ?? error);
});

// ─────────────────────────────────────────────
//  SAFE REPLY — responde sin importar el estado
//  Evita el crash cuando Discord ya expiró
// ─────────────────────────────────────────────
async function safeReply(interaction, opts) {
    try {
        if (interaction.replied)  return await interaction.followUp({ ...opts, ephemeral: true });
        if (interaction.deferred) return await interaction.editReply(opts);
        return await interaction.reply({ ...opts, ephemeral: true });
    } catch (e) {
        if (e?.code === 10062) return; // Interacción expirada — ignorar
        console.warn('⚠️ [safeReply] no se pudo responder:', e?.message);
    }
}

// ─────────────────────────────────────────────
//  SAFE HANDLE — wrapper para todos los handlers
// ─────────────────────────────────────────────
async function safeHandle(interaction, fn) {
    try {
        await fn();
    } catch (err) {
        // Interacción expirada — ignorar completamente, no hacer nada
        if (err?.code === 10062 || err?.message?.includes('Unknown interaction')) return;

        console.error(`❌ [safeHandle] ${interaction.commandName ?? interaction.customId ?? '?'}:`, err?.message ?? err);

        const esFaltaPermisos =
            err?.code === 50013 ||
            err?.message?.toLowerCase().includes('missing permissions') ||
            err?.message?.toLowerCase().includes('missing access');

        const mensaje = esFaltaPermisos
            ? '⚠️ **Faltan permisos.** El bot necesita: `Gestionar canales` `Gestionar roles` `Ver canales` `Enviar mensajes`.'
            : '⚠️ Ocurrió un error inesperado. Intenta de nuevo.';

        await safeReply(interaction, { content: mensaje });
    }
}

// ─────────────────────────────────────────────
//  COOLDOWNS DE COMANDOS
// ─────────────────────────────────────────────
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

// ─────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────
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
    const ms = rangos[rango] ?? Infinity;
    return ventas.filter(v => (ahora - v.timestamp) <= ms);
}
function tiempoRelativo(ms) {
    const min = Math.floor(ms / 60000); const hrs = Math.floor(min / 60); const dias = Math.floor(hrs / 24);
    if (dias > 0) return `${dias}d ${hrs % 24}h`;
    if (hrs > 0)  return `${hrs}h ${min % 60}m`;
    return `${min}m`;
}
function estrellas(n) { return '⭐'.repeat(Math.min(n, 5)); }
function calcDuracion(start, end) {
    const ms = end - start; const min = Math.floor(ms / 60000); const hrs = Math.floor(min / 60); const dias = Math.floor(hrs / 24);
    if (dias > 0) return `${dias}d ${hrs % 24}h`;
    if (hrs > 0)  return `${hrs}h ${min % 60}m`;
    return `${min}m`;
}

// ─────────────────────────────────────────────
//  TIERS — asignar rol automático
// ─────────────────────────────────────────────
async function actualizarTier(guild, userId, comprasTotal, tierRoles) {
    if (!tierRoles || Object.keys(tierRoles).length === 0) return;
    let tierActual = null;
    for (const tier of TIER_UMBRALES) { if (comprasTotal >= tier.minCompras) tierActual = tier.nombre; }
    if (!tierActual) return;
    const roleId = tierRoles[tierActual];
    if (!roleId) return;
    try {
        const miembro = guild.members.cache.get(userId) ?? await guild.members.fetch(userId).catch(() => null);
        if (!miembro) return;
        for (const tier of TIER_UMBRALES) {
            const rId = tierRoles[tier.nombre];
            if (rId && rId !== roleId && miembro.roles.cache.has(rId)) await miembro.roles.remove(rId).catch(() => {});
        }
        if (!miembro.roles.cache.has(roleId)) {
            await miembro.roles.add(roleId);
            console.log(`🎖️ Tier [${tierActual}] → ${miembro.user.tag} en ${guild.name}`);
        }
    } catch (err) { console.warn(`⚠️ No se pudo asignar tier a ${userId}:`, err?.message); }
}

// ─────────────────────────────────────────────
//  EMBEDS DE VENTAS
// ─────────────────────────────────────────────
function buildLogEmbed(venta, n) {
    return new EmbedBuilder().setColor('#5865F2').setTitle('🛒  Nueva orden registrada')
        .setDescription(`> **\`#${n}\`** — ${venta.producto}\n> ━━━━━━━━━━━━━━━━━━━━━━━━\n> 💎  **Cantidad:** \`${formatRobux(venta.robux)}\`\n> 💵  **Precio:**   \`${venta.precio ?? 'No especificado'}\`\n> 💳  **Método:**   \`${venta.metodo}\`\n> ━━━━━━━━━━━━━━━━━━━━━━━━\n> 👤  **Cliente:**  <@${venta.clienteId}>\n> 🤝  **Operador:** <@${venta.vendedorId}>`)
        .setFooter({ text: `Aurex • ${today()}` }).setTimestamp();
}
function buildDMEmbed(venta, n, guildName) {
    return new EmbedBuilder().setColor('#57F287').setTitle('✅  Pedido confirmado')
        .setDescription(`¡Hola! Tu pedido en **${guildName}** fue registrado exitosamente.\n\n> 📦  **Producto:** \`${venta.producto}\`\n> 💎  **Cantidad:** \`${formatRobux(venta.robux)}\`\n> 💵  **Precio:**   \`${venta.precio ?? 'No especificado'}\`\n> 💳  **Método:**   \`${venta.metodo}\`\n> 🔖  **Orden:**    \`#${n}\`\n\n*Guarda este número por si necesitas hacer seguimiento.*`)
        .setFooter({ text: `${guildName} · powered by Aurex` }).setTimestamp();
}
function buildVentaPublicaEmbed(venta, n) {
    return new EmbedBuilder().setColor('#5865F2').setTitle(`🧾  Orden \`#${n}\``)
        .setDescription(`> 📦  **Producto:** \`${venta.producto}\`\n> 💎  **Cantidad:** \`${formatRobux(venta.robux)}\`\n> 💵  **Precio:**   \`${venta.precio ?? 'No especificado'}\`\n> 💳  **Método:**   \`${venta.metodo}\`\n> ━━━━━━━━━━━━━━━━━━━━━━━━\n> 👤  **Cliente:**  <@${venta.clienteId}>\n> 🤝  **Operador:** <@${venta.vendedorId}>`)
        .setFooter({ text: `✅ Registrado • ${today()} • Aurex` }).setTimestamp();
}

function buildHelpEmbed() {
    return new EmbedBuilder().setColor('#5865F2').setTitle('📖  Comandos de Aurex')
        .setDescription(
            `**💸 Pedidos**\n\`/vender\` \`/historial\` \`/orden\` \`/buscar\` \`/cancelar\` \`/exportar\`\n\n` +
            `**📊 Analíticas**\n\`/stats\` \`/top\` \`/dashboard\` \`/perfil\`\n\n` +
            `**📦 Stock**\n\`/stock\` — Ver stock\n\`/stock-admin\` — Gestionar stock *(admins)*\n\`/stock-bulk\` — Cargar varios ítems *(admins)*\n\n` +
            `**⭐ Reputación**\n\`/reseña\` \`/resenas\`\n\n` +
            `**🔧 Utilidades**\n\`/afk\` \`/anuncio\` \`/clear\` \`/ping\`\n\n` +
            `**⚙️ Configuración** *(admins)*\n\`/setlog\` \`/setresenas\` \`/configdm\` \`/setdm\` \`/settiers\`\n\n` +
            `**🎫 Tickets**\n\`/ticket-setup\` — Configura el panel`
        ).setFooter({ text: 'Aurex • /help' }).setTimestamp();
}

// ─────────────────────────────────────────────
//  TICKETS — CATEGORÍAS
// ─────────────────────────────────────────────
const CATEGORIAS = {
    comprar: {
        emoji: '🛒', label: 'Comprar', descripcion: '¿Interesado en adquirir productos o servicios?',
        prefijo: 'compra', color: '#57F287',
        bienvenida: (u) => `### 🛒  Ticket de Compra\n> ¡Hola, **${u}**! Bienvenido a tu ticket de compra.\n> Un operador te atenderá en breve.\n\n**📋 Para agilizar tu pedido, cuéntanos:**\n> 💎  ¿Qué cantidad deseas adquirir?\n> 💵  ¿Cuál es tu presupuesto?\n> 💳  ¿Cuál es tu método de pago?\n> 🌎  ¿De qué país eres?`,
        modal: true
    },
    soporte: {
        emoji: '🎧', label: 'Soporte', descripcion: '¿Tienes una duda, problema o inconveniente?',
        prefijo: 'soporte', color: '#3498DB',
        bienvenida: (u) => `### 🎧  Ticket de Soporte\n> ¡Hola, **${u}**! Abriste un ticket de soporte.\n> Nuestro equipo revisará tu caso lo antes posible.\n\n**📋 Para ayudarte mejor, necesitamos:**\n> ❓  ¿Qué ocurrió exactamente?\n> 🔖  ¿Tienes número de orden? *(si aplica)*\n> 📸  ¿Tienes capturas de pantalla como evidencia?`,
        modal: false
    },
    reporte: {
        emoji: '⚠️', label: 'Reporte', descripcion: '¿Necesitas reportar a alguien o algo?',
        prefijo: 'reporte', color: '#ED4245',
        bienvenida: (u) => `### ⚠️  Ticket de Reporte\n> ¡Hola, **${u}**! Recibimos tu reporte.\n> El staff lo revisará con la mayor seriedad posible.\n\n**📋 Para procesar tu reporte necesitamos:**\n> 👤  Usuario reportado *(tag o ID)*\n> 📝  Motivo del reporte detallado\n> 📸  Evidencia *(capturas, videos, links)*\n> 📅  ¿Cuándo ocurrió el incidente?`,
        modal: false
    },
    otros: {
        emoji: 'ℹ️', label: 'Otros', descripcion: '¿Otra consulta que no encaja en las opciones?',
        prefijo: 'otros', color: '#95A5A6',
        bienvenida: (u) => `### ℹ️  Ticket General\n> ¡Hola, **${u}**! Abriste un ticket de consulta general.\n> Un miembro del staff te atenderá en breve.\n\n**📋 Para ayudarte, cuéntanos:**\n> ✏️  ¿En qué podemos ayudarte hoy?\n> 📎  Agrega cualquier detalle o archivo relevante.`,
        modal: false
    }
};

function buildPanelEmbed(guildName) {
    return new EmbedBuilder().setColor('#5865F2').setTitle('🎫  ¿En qué podemos ayudarte?')
        .setDescription(`> Selecciona la opción que mejor se ajuste a tu necesidad.\n> Un miembro de nuestro equipo te atenderá en breve.\n\n**🛒  Comprar**\n> ¿Estás interesado en adquirir alguno de nuestros productos?\n\n**🎧  Soporte**\n> ¿Tienes alguna duda, inconveniente o problema?\n\n**⚠️  Reporte**\n> ¿Necesitas reportar a un usuario o situación al staff?\n\n**ℹ️  Otros**\n> ¿Otra consulta que no encaja en las opciones anteriores?`)
        .setImage(BANNER_URL).setFooter({ text: `${guildName} · powered by Aurex` }).setTimestamp();
}
function buildPanelRow() {
    return new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder().setCustomId('ticket_categoria').setPlaceholder('Selecciona una opción...')
            .addOptions(Object.entries(CATEGORIAS).map(([key, cat]) =>
                new StringSelectMenuOptionBuilder().setLabel(cat.label).setDescription(cat.descripcion).setEmoji(cat.emoji).setValue(key)
            ))
    );
}

// ─────────────────────────────────────────────
//  TICKETS — LOG HELPER
// ─────────────────────────────────────────────
async function logTicket(guild, tdata, embedLog, archivo = null) {
    if (!tdata.config.logChannelId) return;
    try {
        const canal = guild.channels.cache.get(tdata.config.logChannelId) ?? await guild.channels.fetch(tdata.config.logChannelId).catch(() => null);
        if (!canal) return;
        const opts = { embeds: [embedLog] };
        if (archivo) opts.files = [archivo];
        await canal.send(opts);
    } catch (err) { console.warn('⚠️ No se pudo enviar log de ticket:', err?.message); }
}

// ─────────────────────────────────────────────
//  TICKETS — SETUP
// ─────────────────────────────────────────────
async function handleTicketSetup(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator))
        return safeReply(interaction, { content: '🚫 Solo administradores.' });

    await interaction.deferReply({ ephemeral: true });

    const tdata = loadTickets(interaction.guild.id);
    const canal = interaction.options.getChannel('canal');
    const categoriaDiscord = interaction.options.getChannel('categoria') ?? null;
    const logCanal   = interaction.options.getChannel('logs')      ?? null;
    const vendedorRol = interaction.options.getRole('rol_vendedor') ?? null;
    const staffRol    = interaction.options.getRole('rol_staff')    ?? null;

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
        const mensajeNuevo = await canal.send({ embeds: [embedPanel], components: [rowPanel] });
        tdata.config.panelMessageId = mensajeNuevo.id;
        tdata.config.panelChannelId = canal.id;
    }
    saveTickets(interaction.guild.id, tdata);

    const resumen = [
        `✅ Panel ${panelActualizado ? 'actualizado' : `enviado a <#${canal.id}>`}`,
        categoriaDiscord ? `📁 Categoría: **${categoriaDiscord.name}**` : '',
        logCanal         ? `📋 Logs: <#${logCanal.id}>`                 : '',
        vendedorRol      ? `💼 Rol vendedor: <@&${vendedorRol.id}>`     : '',
        staffRol         ? `🛡️ Rol staff: <@&${staffRol.id}>`           : ''
    ].filter(Boolean).join('\n');

    return interaction.editReply({ content: resumen });
}

// ─────────────────────────────────────────────
//  TICKETS — ABRIR
//  defer SIEMPRE primero para evitar expiración
// ─────────────────────────────────────────────
async function abrirTicket(interaction, categoriaKey, datosModal = null) {
    const guild = interaction.guild;
    const user  = interaction.user;
    const tdata = loadTickets(guild.id);
    const cat   = CATEGORIAS[categoriaKey];

    // Verificar ticket abierto
    const ticketAbierto = tdata.tickets.find(t => t.userId === user.id && t.estado === 'abierto');
    if (ticketAbierto) {
        const canalExistente = guild.channels.cache.get(ticketAbierto.channelId)
            ?? await guild.channels.fetch(ticketAbierto.channelId).catch(() => null);
        if (canalExistente) {
            return safeReply(interaction, { content: `⚠️ Ya tienes un ticket abierto: <#${ticketAbierto.channelId}>\nDebes cerrarlo antes de abrir uno nuevo.` });
        } else {
            ticketAbierto.estado = 'cerrado';
            ticketAbierto.cerradoPor = 'Sistema (canal eliminado)';
            ticketAbierto.cerradoAt = Date.now();
            saveTickets(guild.id, tdata);
        }
    }

    // Cooldown (10 min)
    if (!tdata.cooldowns) tdata.cooldowns = {};
    const ultimoCierre = tdata.cooldowns[user.id] ?? 0;
    const COOLDOWN_MS  = 10 * 60 * 1000;
    const restante     = COOLDOWN_MS - (Date.now() - ultimoCierre);
    if (restante > 0 && ultimoCierre > 0) {
        const min = Math.ceil(restante / 60000);
        return safeReply(interaction, { content: `⏳ Debes esperar **${min} minuto(s)** antes de abrir un nuevo ticket.` });
    }

    // Verificar permisos del bot
    const botMember = guild.members.me;
    if (!botMember.permissions.has(PermissionFlagsBits.ManageChannels)) {
        return safeReply(interaction, { content: '⚠️ **Faltan permisos.** El bot necesita **Gestionar canales** para crear tickets.' });
    }

    // Crear canal
    const nombreCanal = `${cat.prefijo}-${user.username.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20) || 'usuario'}`;
    const permisos = [
        { id: guild.id,      deny:  [PermissionFlagsBits.ViewChannel] },
        { id: user.id,       allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
        { id: botMember.id,  allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageMessages, PermissionFlagsBits.ManageChannels] }
    ];
    if (tdata.config.staffRoleId)
        permisos.push({ id: tdata.config.staffRoleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageMessages] });
    if (categoriaKey === 'comprar' && tdata.config.vendedorRoleId)
        permisos.push({ id: tdata.config.vendedorRoleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] });

    const canalTicket = await guild.channels.create({
        name: nombreCanal, type: ChannelType.GuildText,
        parent: tdata.config.categoryId ?? null,
        permissionOverwrites: permisos
    });

    const ticketId = tdata.tickets.length + 1;
    tdata.tickets.push({ id: ticketId, channelId: canalTicket.id, userId: user.id, userTag: user.tag, categoria: categoriaKey, estado: 'abierto', timestamp: Date.now(), datosModal });
    saveTickets(guild.id, tdata);

    let descripcion = cat.bienvenida(user.username);
    if (datosModal) {
        descripcion += `\n\n**📋 Datos de tu pedido:**\n> 💎  **Cantidad:**    \`${datosModal.cantidad}\`\n> 💵  **Presupuesto:** \`${datosModal.precio}\`\n> 💳  **Método:**      \`${datosModal.metodo}\``;
    }

    const embedBienvenida = new EmbedBuilder().setColor(cat.color).setImage(BANNER_URL)
        .setDescription(descripcion).setFooter({ text: `Ticket #${ticketId} • ${guild.name} · Aurex` }).setTimestamp();
    const rowCerrar = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`ticket_cerrar_${ticketId}`).setLabel('🔒 Cerrar ticket').setStyle(ButtonStyle.Danger)
    );
    const menciones = [`<@${user.id}>`];
    if (categoriaKey === 'comprar' && tdata.config.vendedorRoleId) menciones.push(`<@&${tdata.config.vendedorRoleId}>`);
    else if (tdata.config.staffRoleId) menciones.push(`<@&${tdata.config.staffRoleId}>`);

    await canalTicket.send({ content: menciones.join(' '), embeds: [embedBienvenida], components: [rowCerrar] });

    await logTicket(guild, tdata, new EmbedBuilder().setColor('#57F287').setTitle(`📂  Ticket #${ticketId} abierto`)
        .setDescription(`> 👤  **Usuario:**   <@${user.id}> (\`${user.tag}\`)\n> 🗂️  **Categoría:** ${cat.emoji} \`${cat.label}\`\n> 📌  **Canal:**     <#${canalTicket.id}>`).setTimestamp());

    return safeReply(interaction, { content: `✅ Tu ticket fue creado: <#${canalTicket.id}>` });
}

// ─────────────────────────────────────────────
//  TICKETS — CERRAR
// ─────────────────────────────────────────────
async function cerrarTicket(interaction, ticketId) {
    const guild  = interaction.guild;
    const tdata  = loadTickets(guild.id);
    const ticket = tdata.tickets.find(t => t.id === ticketId);

    if (!ticket || ticket.estado === 'cerrado')
        return safeReply(interaction, { content: '⚠️ Este ticket ya fue cerrado.' });

    const esAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
    const esStaff = tdata.config.staffRoleId ? interaction.member.roles.cache.has(tdata.config.staffRoleId) : false;
    const esDueño = interaction.user.id === ticket.userId;
    if (!esAdmin && !esStaff && !esDueño)
        return safeReply(interaction, { content: '🚫 No tienes permiso para cerrar este ticket.' });

    await interaction.deferReply();

    const mensajes = await interaction.channel.messages.fetch({ limit: 100 });
    const cat = CATEGORIAS[ticket.categoria];
    let transcript = `TRANSCRIPT — Ticket #${ticket.id} (${cat.label})\nUsuario: ${ticket.userTag}\nCerrado por: ${interaction.user.tag}\nFecha: ${new Date().toLocaleString('es-MX')}\nDuración: ${calcDuracion(ticket.timestamp, Date.now())}\n${'─'.repeat(60)}\n\n`;
    mensajes.reverse().forEach(m => {
        if (m.author.bot) return;
        transcript += `[${new Date(m.createdTimestamp).toLocaleString('es-MX')}] ${m.author.tag}: ${m.content}\n`;
        if (m.embeds.length > 0) transcript += `  [embed adjunto]\n`;
    });

    if (!tdata.cooldowns) tdata.cooldowns = {};
    tdata.cooldowns[ticket.userId] = Date.now();
    ticket.estado = 'cerrado'; ticket.cerradoPor = interaction.user.tag; ticket.cerradoAt = Date.now();
    saveTickets(guild.id, tdata);

    const embedCierre = new EmbedBuilder().setColor('#ED4245').setTitle('🔒  Ticket cerrado')
        .setDescription(`> Cerrado por <@${interaction.user.id}>\n> El canal será eliminado en **5 segundos**.\n\n*El transcript fue enviado a tu DM.*`).setTimestamp();
    await interaction.editReply({ embeds: [embedCierre] });

    try {
        const gdata = loadData(guild.id);
        const dmTexto = gdata.config.dmCierreTexto ??
            `¡Hola, **{usuario}**! 👋\n\nEsperamos haberte atendido de la mejor manera en **{servidor}**.\n\n> *Si tuviste algún inconveniente, no dudes en abrir un nuevo ticket.*\n\n¡Gracias por confiar en nosotros! 💙`;
        const mensajeFinal = dmTexto.replace('{usuario}', ticket.userTag).replace('{servidor}', guild.name);
        const embedDM = new EmbedBuilder().setColor('#5865F2').setTitle('🎫  Tu ticket fue cerrado')
            .setDescription(`> **Servidor:**    \`${guild.name}\`\n> **Categoría:**   ${cat.emoji} \`${cat.label}\`\n> **Cerrado por:** \`${interaction.user.tag}\`\n> **Duración:**    \`${calcDuracion(ticket.timestamp, Date.now())}\`\n\n━━━━━━━━━━━━━━━━━━━━━━━━\n\n${mensajeFinal}`)
            .setFooter({ text: `${guild.name} · powered by Aurex` }).setTimestamp();
        const buffer = Buffer.from(transcript, 'utf8');
        const miembro = guild.members.cache.get(ticket.userId) ?? await guild.members.fetch(ticket.userId).catch(() => null);
        if (miembro) await miembro.send({ embeds: [embedDM], files: [{ attachment: buffer, name: `transcript-ticket${ticketId}.txt` }] });
    } catch { console.warn(`⚠️ No se pudo enviar DM de cierre a ${ticket.userTag}`); }

    const buffer = Buffer.from(transcript, 'utf8');
    await logTicket(guild, tdata,
        new EmbedBuilder().setColor('#ED4245').setTitle(`📋  Ticket #${ticketId} cerrado`)
            .setDescription(`> 👤  **Usuario:**    <@${ticket.userId}> (\`${ticket.userTag}\`)\n> 🗂️  **Categoría:**  ${cat.emoji} \`${cat.label}\`\n> 🔒  **Cerrado por:** \`${interaction.user.tag}\`\n> ⏱️  **Duración:**   \`${calcDuracion(ticket.timestamp, Date.now())}\``)
            .setTimestamp(),
        { attachment: buffer, name: `transcript-ticket${ticketId}.txt` }
    );

    setTimeout(() => { interaction.channel.delete().catch(() => {}); }, 5000);
}

// ─────────────────────────────────────────────
//  TICKETS — HANDLER CENTRAL
// ─────────────────────────────────────────────
async function handleTicketInteraction(interaction) {
    if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_categoria') {
        const categoriaKey = interaction.values[0];
        const cat = CATEGORIAS[categoriaKey];
        if (cat.modal) {
            const modal = new ModalBuilder().setCustomId(`ticket_modal_${categoriaKey}`).setTitle(`Ticket — ${cat.label}`);
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('cantidad').setLabel('¿Cuánto deseas adquirir?').setPlaceholder('Ej: 1000, 5k').setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('precio').setLabel('¿Cuál es tu presupuesto?').setPlaceholder('Ej: $5 USD, 130 MXN').setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('metodo').setLabel('¿Método de pago?').setPlaceholder('Ej: PayPal, Binance, Mercado Pago').setStyle(TextInputStyle.Short).setRequired(true))
            );
            return interaction.showModal(modal);
        }
        // defer inmediato para categorías sin modal
        await interaction.deferReply({ ephemeral: true });
        return abrirTicket(interaction, categoriaKey);
    }

    if (interaction.isModalSubmit() && interaction.customId.startsWith('ticket_modal_')) {
        const categoriaKey = interaction.customId.replace('ticket_modal_', '');
        await interaction.deferReply({ ephemeral: true });
        const datosModal = {
            cantidad: interaction.fields.getTextInputValue('cantidad'),
            precio:   interaction.fields.getTextInputValue('precio'),
            metodo:   interaction.fields.getTextInputValue('metodo')
        };
        return abrirTicket(interaction, categoriaKey, datosModal);
    }

    if (interaction.isButton() && interaction.customId.startsWith('ticket_cerrar_')) {
        const ticketId = parseInt(interaction.customId.replace('ticket_cerrar_', ''));
        return cerrarTicket(interaction, ticketId);
    }
}

// ─────────────────────────────────────────────
//  STOCK-BULK — Modal interactivo
//  Abre un modal con campo de texto grande
//  para pegar los ítems cómodamente
// ─────────────────────────────────────────────
async function handleStockBulkModal(interaction) {
    // Recibir datos del modal
    const texto = interaction.fields.getTextInputValue('items_texto');
    const modo  = interaction.fields.getTextInputValue('modo_valor').trim().toLowerCase();
    const modoFinal = (modo === 'r' || modo === 'reemplazar') ? 'reemplazar' : 'agregar';

    const data   = loadData(interaction.guild.id);
    if (!data.stock) data.stock = [];

    const lineas = texto.split('\n').map(l => l.trim()).filter(Boolean);
    if (lineas.length === 0) return safeReply(interaction, { content: '⚠️ No se detectó ningún ítem.' });
    if (lineas.length > 50)  return safeReply(interaction, { content: '⚠️ Máximo 50 ítems por vez.' });

    if (modoFinal === 'reemplazar') data.stock = [];

    const agregados = [];
    const errores   = [];

    for (const linea of lineas) {
        const partes   = linea.split('|').map(p => p.trim());
        const nombre   = partes[0];
        if (!nombre) { errores.push(`⚠️ Sin nombre: \`${linea.slice(0, 30)}\``); continue; }
        const cantidad = partes[1] ? parseInt(partes[1]) : 0;
        const precio   = partes[2] || null;
        const notas    = partes[3] || null;
        const idx      = data.stock.findIndex(i => i.nombre.toLowerCase() === nombre.toLowerCase());
        if (idx !== -1) {
            data.stock[idx] = { nombre, cantidad: isNaN(cantidad) ? data.stock[idx].cantidad : cantidad, precio: precio ?? data.stock[idx].precio, notas: notas ?? data.stock[idx].notas };
        } else {
            data.stock.push({ nombre, cantidad: isNaN(cantidad) ? 0 : cantidad, precio, notas });
        }
        agregados.push(nombre);
    }

    saveData(interaction.guild.id, data);

    const embed = new EmbedBuilder().setColor('#57F287')
        .setTitle(`📦  Stock ${modoFinal === 'reemplazar' ? 'reemplazado' : 'actualizado'}`)
        .setDescription(
            `> ✅  **${agregados.length}** ítem(s) cargados\n` +
            (modoFinal === 'reemplazar' ? '> 🔄  Stock anterior eliminado\n' : '') +
            (errores.length > 0 ? `> ⚠️  **${errores.length}** error(es)\n` : '') +
            `\n**Ítems procesados:**\n${agregados.map(n => `> \`${n}\``).join('\n')}` +
            (errores.length > 0 ? `\n\n**Errores:**\n${errores.join('\n')}` : '')
        )
        .setFooter({ text: `Stock total: ${data.stock.length} ítem(s)` })
        .setTimestamp();

    return safeReply(interaction, { content: '', embeds: [embed] });
}

// ─────────────────────────────────────────────
//  CLIENTE
// ─────────────────────────────────────────────
const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers]
});

// Capturar errores del cliente — sin esto Node crashea al emitir 'error'
client.on('error', (err) => {
    if (err?.code === 10062) return;
    console.error('❌ [Client error]', err?.message ?? err);
});

client.once('clientReady', () => {
    console.log(`✅ Bot listo como ${client.user.tag}`);
    client.user.setActivity('Aurex • /help 💎', { type: 3 });
    setInterval(() => {
        console.log(`💓 Keep-alive • ${new Date().toLocaleString('es-MX')} • ${client.ws.ping}ms`);
    }, 5 * 60 * 1000);
});

// ─────────────────────────────────────────────
//  MENSAJES (prefix + AFK)
// ─────────────────────────────────────────────
client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;
    const data = loadData(message.guild.id);

    if (data.afk[message.author.id]) {
        const afkData = data.afk[message.author.id];
        const duracion = tiempoRelativo(Date.now() - afkData.tiempo);
        const menciones = afkData.menciones ?? [];
        delete data.afk[message.author.id];
        saveData(message.guild.id, data);
        let desc = `### 👋  ¡Bienvenido de vuelta!\n\n> Removí tu AFK. Estuviste ausente **${duracion}**`;
        if (menciones.length > 0) {
            const lista = menciones.map(m => `> • **[${m.tag}](${m.url})** — <t:${Math.floor(m.timestamp / 1000)}:R>`).join('\n');
            desc += `\n\n**📬 Te mencionaron (${menciones.length}):**\n${lista}`;
        }
        await message.reply({ embeds: [new EmbedBuilder().setColor('#57F287').setDescription(desc).setTimestamp()] }).catch(() => {});
        return;
    }

    if (message.mentions.users.size > 0) {
        for (const [, usuario] of message.mentions.users) {
            if (data.afk[usuario.id] && message.author.id !== usuario.id) {
                const afkInfo = data.afk[usuario.id];
                if (!afkInfo.menciones) afkInfo.menciones = [];
                afkInfo.menciones.push({ tag: message.author.tag, userId: message.author.id, url: message.url, timestamp: Date.now() });
                saveData(message.guild.id, data);
                const min = tiempoRelativo(Date.now() - afkInfo.tiempo);
                await message.reply({ embeds: [new EmbedBuilder().setColor('#ED4245').setDescription(`> 💤  **${usuario.username}** está AFK hace **${min}**\n> *Motivo: ${afkInfo.motivo}*\n\nTu mención fue registrada y la verá al volver.`)] }).catch(() => {});
            }
        }
    }

    if (message.mentions.has(client.user)) {
        await message.reply({ embeds: [new EmbedBuilder().setColor('#5865F2').setDescription(`### 👋  ¡Hola!\n\n> Usa \`/help\` para ver todos mis comandos.`)] }).catch(() => {});
        return;
    }

    if (!message.content.startsWith(PREFIX)) return;
    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const cmd  = args.shift().toLowerCase();
    if (cmd === 'ping') return message.reply(`🏓 Pong! \`${Math.round(client.ws.ping)}ms\``).catch(() => {});
    if (cmd === 'help') return message.reply({ embeds: [buildHelpEmbed()] }).catch(() => {});
    if (cmd === 'afk') {
        const motivo = args.join(' ') || 'Sin motivo';
        data.afk[message.author.id] = { motivo, tiempo: Date.now(), menciones: [] };
        saveData(message.guild.id, data);
        await message.reply({ embeds: [new EmbedBuilder().setColor('#3498DB').setDescription(`### 💤  AFK activado\n\n> **${message.author.username}** — *${motivo}*`)] }).catch(() => {});
    }
});

// ─────────────────────────────────────────────
//  INTERACCIONES
// ─────────────────────────────────────────────
client.on('interactionCreate', async (interaction) => {

    // Tickets
    if (
        (interaction.isStringSelectMenu() && interaction.customId === 'ticket_categoria') ||
        (interaction.isModalSubmit()      && interaction.customId.startsWith('ticket_modal_')) ||
        (interaction.isButton()           && interaction.customId.startsWith('ticket_cerrar_'))
    ) return safeHandle(interaction, () => handleTicketInteraction(interaction));

    // Modal de stock-bulk
    if (interaction.isModalSubmit() && interaction.customId === 'stock_bulk_modal') {
        return safeHandle(interaction, () => handleStockBulkModal(interaction));
    }

    // Botones
    if (interaction.isButton()) {
        if (interaction.customId.startsWith('cancelar_confirm_')) {
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
                return interaction.update({ embeds: [new EmbedBuilder().setColor('#ED4245').setTitle('❌  Orden cancelada').setDescription(`> 🔖  **Orden:**    \`#${ordenId}\`\n> 📦  **Producto:** \`${venta.producto}\`\n> 👤  **Cliente:**  <@${venta.clienteId}>\n> 🔨  **Por:**      <@${interaction.user.id}>`).setTimestamp()], components: [] });
            });
        }
        if (interaction.customId.startsWith('cancelar_abort_'))
            return interaction.update({ content: '✅ Cancelación abortada.', components: [] }).catch(() => {});

        if (interaction.customId.startsWith('reseña_')) {
            return safeHandle(interaction, async () => {
                const ordenId = parseInt(interaction.customId.split('_')[1]);
                const data = loadData(interaction.guild.id);
                const venta = data.ventas.find(v => v.id === ordenId);
                if (!venta || interaction.user.id !== venta.clienteId) return safeReply(interaction, { content: '⚠️ Solo el cliente de esta orden puede dejar reseña.' });
                if (data.resenas.find(r => r.ordenId === ordenId)) return safeReply(interaction, { content: '⚠️ Ya dejaste una reseña para esta orden.' });
                const modal = new ModalBuilder().setCustomId(`modal_resena_${ordenId}`).setTitle(`Reseña — Orden #${ordenId}`);
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('estrellas').setLabel('Calificación (1 a 5)').setPlaceholder('Número del 1 al 5').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(1)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('comentario').setLabel('Comentario (opcional)').setStyle(TextInputStyle.Paragraph).setRequired(false).setMaxLength(300))
                );
                return interaction.showModal(modal);
            });
        }
    }

    // Modal reseña
    if (interaction.isModalSubmit() && interaction.customId.startsWith('modal_resena_')) {
        return safeHandle(interaction, async () => {
            const ordenId = parseInt(interaction.customId.split('_')[2]);
            const data = loadData(interaction.guild.id);
            const venta = data.ventas.find(v => v.id === ordenId);
            const numEstrellas = parseInt(interaction.fields.getTextInputValue('estrellas'));
            const comentario   = interaction.fields.getTextInputValue('comentario') || null;
            if (isNaN(numEstrellas) || numEstrellas < 1 || numEstrellas > 5) return safeReply(interaction, { content: '⚠️ La calificación debe ser un número del 1 al 5.' });
            data.resenas.push({ ordenId, clienteId: venta.clienteId, clienteTag: venta.clienteTag, vendedorId: venta.vendedorId, estrellas: numEstrellas, comentario, timestamp: Date.now() });
            saveData(interaction.guild.id, data);
            const embedResena = new EmbedBuilder().setColor('#FEE75C').setTitle(`${estrellas(numEstrellas)}  Reseña — Orden \`#${ordenId}\``)
                .setDescription(`> 👤  **Cliente:**  <@${venta.clienteId}>\n> 🤝  **Operador:** <@${venta.vendedorId}>\n` + (comentario ? `\n> 💬  *"${comentario}"*` : '')).setTimestamp();
            await safeReply(interaction, { content: '', embeds: [embedResena] });
            if (data.config.resenaChannelId) {
                const canal = interaction.guild.channels.cache.get(data.config.resenaChannelId);
                if (canal) await canal.send({ embeds: [embedResena] }).catch(() => {});
            }
        });
    }

    if (!interaction.isChatInputCommand()) return;

    safeHandle(interaction, async () => {
        const data  = loadData(interaction.guild.id);
        const guild = interaction.guild;
        const user  = interaction.user;

        if (interaction.commandName === 'help')   return safeReply(interaction, { content: '', embeds: [buildHelpEmbed()] });
        if (interaction.commandName === 'ping')   return safeReply(interaction, { content: `🏓 Pong! \`${Math.round(client.ws.ping)}ms\`` });
        if (interaction.commandName === 'ticket-setup') return handleTicketSetup(interaction);

        // /settiers
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
            saveData(guild.id, data);
            const tr = data.config.tierRoles;
            return safeReply(interaction, { content: '', embeds: [new EmbedBuilder().setColor('#FEE75C').setTitle('🎖️  Tiers configurados')
                .setDescription(
                    `> 🥉  **Bronce** (1+ compra):   ${tr.bronce ? `<@&${tr.bronce}>` : '`No configurado`'}\n` +
                    `> 🥈  **Plata**  (5+ compras):  ${tr.plata  ? `<@&${tr.plata}>`  : '`No configurado`'}\n` +
                    `> 🥇  **Oro**    (10+ compras): ${tr.oro    ? `<@&${tr.oro}>`    : '`No configurado`'}\n` +
                    `> 💎  **VIP**    (20+ compras): ${tr.vip    ? `<@&${tr.vip}>`    : '`No configurado`'}`
                ).setFooter({ text: 'Los roles se asignan automáticamente al registrar una venta.' }).setTimestamp()] });
        }

        // /vender
        if (interaction.commandName === 'vender') {
            const espera = checkCooldown(guild.id, user.id, 'vender', 10);
            if (espera > 0) return safeReply(interaction, { content: `⏳ Espera **${espera}s**.` });
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
            if (data.config.dmEnabled) { try { await clienteU.send({ embeds: [buildDMEmbed(venta, n, guild.name)] }); } catch { console.warn(`⚠️ No se pudo enviar DM a ${clienteU.tag}`); } }
            if (data.config.logChannelId) { const lc = guild.channels.cache.get(data.config.logChannelId); if (lc) await lc.send({ embeds: [buildLogEmbed(venta, n)] }).catch(() => {}); }
            if (data.analytics.totalVentas % 10 === 0) await interaction.followUp({ embeds: [new EmbedBuilder().setColor('#FEE75C').setTitle('🏆  ¡Nuevo hito!').setDescription(`> **${guild.name}** alcanzó **${data.analytics.totalVentas}** pedidos.\n> 💎 Total: \`${formatRobux(data.analytics.totalRobux)}\``)] }).catch(() => {});
            return;
        }

        // /orden
        if (interaction.commandName === 'orden') {
            const ordenId = interaction.options.getInteger('id');
            const venta = data.ventas.find(v => v.id === ordenId);
            if (!venta) return safeReply(interaction, { content: `⚠️ No existe la orden \`#${ordenId}\`.` });
            const resena = data.resenas?.find(r => r.ordenId === ordenId);
            return safeReply(interaction, { content: '', embeds: [new EmbedBuilder().setColor(venta.estado === 'cancelada' ? '#ED4245' : '#5865F2')
                .setTitle(`${venta.estado === 'cancelada' ? '❌' : '✅'}  Orden \`#${venta.id}\``)
                .setDescription(`> 📦  **Producto:** \`${venta.producto}\`\n> 💎  **Cantidad:** \`${formatRobux(venta.robux)}\`\n> 💵  **Precio:**   \`${venta.precio}\`\n> 💳  **Método:**   \`${venta.metodo}\`\n> ━━━━━━━━━━━━━━━━━━━━━━━━\n> 👤  **Cliente:**  <@${venta.clienteId}>\n> 🤝  **Operador:** <@${venta.vendedorId}>\n\n**⭐ Reseña:** ${resena ? `${estrellas(resena.estrellas)}${resena.comentario ? ` *"${resena.comentario}"*` : ''}` : '*Sin reseña aún*'}`)
                .setFooter({ text: `Estado: ${venta.estado}` }).setTimestamp(venta.timestamp)] });
        }

        // /buscar
        if (interaction.commandName === 'buscar') {
            const objetivo = interaction.options.getUser('cliente');
            const ventas = data.ventas.filter(v => v.clienteId === objetivo.id && v.estado !== 'cancelada');
            if (ventas.length === 0) return safeReply(interaction, { content: `📭 **${objetivo.username}** no tiene pedidos.` });
            const ultimas = ventas.slice(-8).reverse();
            const totalRobux = ventas.reduce((s, v) => s + v.robux, 0);
            const resenas = data.resenas?.filter(r => r.clienteId === objetivo.id) ?? [];
            const promedio = resenas.length > 0 ? (resenas.reduce((s, r) => s + r.estrellas, 0) / resenas.length).toFixed(1) : null;
            return safeReply(interaction, { content: '', embeds: [new EmbedBuilder().setColor('#5865F2').setTitle(`👤  Historial de ${objetivo.username}`).setThumbnail(objetivo.displayAvatarURL({ dynamic: true }))
                .setDescription(`> 🛒  **Pedidos:** \`${ventas.length}\`\n> 💎  **R$ gastados:** \`${formatRobux(totalRobux)}\`\n${promedio ? `> ⭐  **Promedio:** \`${promedio}/5\`\n` : ''}\n**Últimos pedidos:**\n${ultimas.map(v => `> \`#${v.id}\` **${v.producto}** — \`${formatRobux(v.robux)}\` — <t:${Math.floor(v.timestamp / 1000)}:d>`).join('\n')}`)
                .setFooter({ text: `Mostrando ${ultimas.length} de ${ventas.length}` }).setTimestamp()] });
        }

        // /historial
        if (interaction.commandName === 'historial') {
            const rango = interaction.options.getString('rango') ?? 'todo';
            const filtroU = interaction.options.getUser('usuario');
            let ventas = rango === 'todo' ? data.ventas : ventasPorRango(data.ventas, rango);
            if (filtroU) ventas = ventas.filter(v => v.clienteId === filtroU.id || v.vendedorId === filtroU.id);
            if (ventas.length === 0) return safeReply(interaction, { content: '📭 No hay pedidos con ese filtro.' });
            const ultimas = ventas.slice(-10).reverse();
            return safeReply(interaction, { content: '', embeds: [new EmbedBuilder().setColor('#5865F2').setTitle(`📜  Historial — ${guild.name}`)
                .setDescription(ultimas.map(v => { const t = v.estado === 'cancelada' ? '~~' : ''; return `> \`#${v.id}\` ${t}**${v.producto}**${t} — \`${formatRobux(v.robux)}\` — <@${v.clienteId}>`; }).join('\n') + `\n\n> 🧾  **Total:** \`${ventas.length}\`\n> 💎  **R$ movidos:** \`${formatRobux(ventas.reduce((s, v) => s + v.robux, 0))}\``)
                .setFooter({ text: `Últimos ${ultimas.length} de ${ventas.length}` }).setTimestamp()] });
        }

        // /reseña
        if (interaction.commandName === 'reseña') {
            const ordenId = interaction.options.getInteger('orden');
            const venta = data.ventas.find(v => v.id === ordenId);
            if (!venta) return safeReply(interaction, { content: `⚠️ No existe la orden \`#${ordenId}\`.` });
            if (venta.clienteId !== user.id) return safeReply(interaction, { content: '⚠️ Solo el cliente puede dejar reseña.' });
            if (data.resenas?.find(r => r.ordenId === ordenId)) return safeReply(interaction, { content: '⚠️ Ya dejaste una reseña para esta orden.' });
            const modal = new ModalBuilder().setCustomId(`modal_resena_${ordenId}`).setTitle(`Reseña — Orden #${ordenId}`);
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('estrellas').setLabel('Calificación (1 a 5)').setPlaceholder('Número del 1 al 5').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(1)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('comentario').setLabel('Comentario (opcional)').setStyle(TextInputStyle.Paragraph).setRequired(false).setMaxLength(300))
            );
            return interaction.showModal(modal);
        }

        // /resenas
        if (interaction.commandName === 'resenas') {
            const objetivo = interaction.options.getUser('vendedor');
            const resenas = data.resenas?.filter(r => r.vendedorId === objetivo.id) ?? [];
            if (resenas.length === 0) return safeReply(interaction, { content: `📭 **${objetivo.username}** no tiene reseñas.` });
            const promedio = (resenas.reduce((s, r) => s + r.estrellas, 0) / resenas.length).toFixed(1);
            const ultimas = resenas.slice(-5).reverse();
            return safeReply(interaction, { content: '', embeds: [new EmbedBuilder().setColor('#FEE75C').setTitle(`⭐  Reseñas de ${objetivo.username}`).setThumbnail(objetivo.displayAvatarURL({ dynamic: true }))
                .setDescription(`> **Promedio:** \`${promedio}/5\` *(${resenas.length} reseña${resenas.length !== 1 ? 's' : ''})*\n\n${ultimas.map(r => `> ${estrellas(r.estrellas)} <@${r.clienteId}>` + (r.comentario ? ` — *"${r.comentario}"*` : '')).join('\n')}`)
                .setFooter({ text: `Últimas ${ultimas.length} de ${resenas.length}` }).setTimestamp()] });
        }

        // /cancelar
        if (interaction.commandName === 'cancelar') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) return safeReply(interaction, { content: '🚫 Necesitas permiso de **Gestionar mensajes**.' });
            const ordenId = interaction.options.getInteger('orden');
            const venta = data.ventas.find(v => v.id === ordenId);
            if (!venta) return safeReply(interaction, { content: `⚠️ No existe la orden \`#${ordenId}\`.` });
            if (venta.estado === 'cancelada') return safeReply(interaction, { content: '⚠️ Ya está cancelada.' });
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`cancelar_confirm_${ordenId}`).setLabel('Sí, cancelar').setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId(`cancelar_abort_${ordenId}`).setLabel('No, mantener').setStyle(ButtonStyle.Secondary)
            );
            return safeReply(interaction, { content: '', embeds: [new EmbedBuilder().setColor('#ED4245').setTitle(`⚠️  ¿Cancelar orden \`#${ordenId}\`?`).setDescription(`> 📦  **Producto:** \`${venta.producto}\`\n> 👤  **Cliente:**  <@${venta.clienteId}>\n> 💎  **Cantidad:** \`${formatRobux(venta.robux)}\`\n\n*Esta acción **no se puede deshacer**.*`)], components: [row] });
        }

        // /exportar
        if (interaction.commandName === 'exportar') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) return safeReply(interaction, { content: '🚫 Necesitas permiso de **Gestionar mensajes**.' });
            const rango = interaction.options.getString('rango') ?? 'mes';
            const ventas = ventasPorRango(data.ventas, rango).filter(v => v.estado !== 'cancelada');
            if (ventas.length === 0) return safeReply(interaction, { content: '📭 No hay pedidos en ese período.' });
            const etiquetas = { hoy: 'Hoy', semana: 'Esta semana', mes: 'Este mes' };
            const totalRobux = ventas.reduce((s, v) => s + v.robux, 0);
            let texto = `REPORTE — ${etiquetas[rango] ?? rango}\nServidor: ${guild.name}\nGenerado: ${new Date().toLocaleString('es-MX')}\n${'─'.repeat(60)}\n\n`;
            ventas.forEach(v => { texto += `#${v.id} | ${v.producto} | ${formatRobux(v.robux)} | ${v.precio} | ${v.metodo} | Cliente: ${v.clienteTag} | Operador: ${v.vendedorTag}\n`; });
            texto += `\n${'─'.repeat(60)}\nTOTAL: ${ventas.length} pedidos | ${formatRobux(totalRobux)}\n`;
            return interaction.reply({ content: `📁 **${ventas.length}** pedidos exportados:`, files: [{ attachment: Buffer.from(texto, 'utf8'), name: `pedidos-${rango}.txt` }], ephemeral: true });
        }

        // /perfil
        if (interaction.commandName === 'perfil') {
            const objetivo = interaction.options.getUser('usuario');
            const comoVendedor = data.ventas.filter(v => v.vendedorId === objetivo.id && v.estado !== 'cancelada');
            const comoCliente  = data.ventas.filter(v => v.clienteId  === objetivo.id && v.estado !== 'cancelada');
            const resenas = data.resenas?.filter(r => r.vendedorId === objetivo.id) ?? [];
            const promedio = resenas.length > 0 ? `${(resenas.reduce((s, r) => s + r.estrellas, 0) / resenas.length).toFixed(1)}/5` : 'Sin reseñas';
            const comprasCliente = data.analytics.porCliente?.[objetivo.id]?.compras ?? 0;
            let tierActual = 'Sin tier';
            for (const tier of TIER_UMBRALES) { if (comprasCliente >= tier.minCompras) tierActual = tier.nombre.charAt(0).toUpperCase() + tier.nombre.slice(1); }
            const tierEmoji = { Bronce: '🥉', Plata: '🥈', Oro: '🥇', Vip: '💎' }[tierActual] ?? '';
            return safeReply(interaction, { content: '', embeds: [new EmbedBuilder().setColor('#5865F2').setTitle(`👤  ${objetivo.username}`).setThumbnail(objetivo.displayAvatarURL({ dynamic: true }))
                .setDescription(`**Como operador**\n> 🧾  **Pedidos:**    \`${comoVendedor.length}\`\n> 💎  **R$ movidos:** \`${formatRobux(comoVendedor.reduce((s, v) => s + v.robux, 0))}\`\n> ⭐  **Valoración:** \`${promedio}\`\n\n**Como cliente**\n> 🛒  **Compras:**    \`${comoCliente.length}\`\n> 💎  **R$ gastados:** \`${formatRobux(comoCliente.reduce((s, v) => s + v.robux, 0))}\`\n> 🎖️  **Tier:**       \`${tierEmoji} ${tierActual}\``)
                .setFooter({ text: guild.name }).setTimestamp()] });
        }

        // /stats
        if (interaction.commandName === 'stats') {
            const rango = interaction.options.getString('rango') ?? 'hoy';
            const ventas = ventasPorRango(data.ventas, rango).filter(v => v.estado !== 'cancelada');
            const robux = ventas.reduce((s, v) => s + v.robux, 0);
            const etiquetas = { hoy: 'Hoy', semana: 'Esta semana', mes: 'Este mes' };
            return safeReply(interaction, { content: '', embeds: [new EmbedBuilder().setColor('#FEE75C').setTitle(`📊  Stats — ${etiquetas[rango] ?? rango}`)
                .setDescription(`> 🧾  **Pedidos:**         \`${ventas.length}\`\n> 💎  **R$ movidos:**      \`${formatRobux(robux)}\`\n> 👥  **Clientes únicos:** \`${new Set(ventas.map(v => v.clienteId)).size}\`\n\n> 📦  **Total histórico:** \`${data.ventas.filter(v => v.estado !== 'cancelada').length}\`\n> 💰  **Total R$ hist.:**  \`${formatRobux(data.analytics.totalRobux)}\``)
                .setFooter({ text: guild.name }).setTimestamp()] });
        }

        // /top
        if (interaction.commandName === 'top') {
            const tipo = interaction.options.getString('tipo') ?? 'vendedores';
            const por  = interaction.options.getString('por')  ?? 'ventas';
            const medallas = ['🥇', '🥈', '🥉'];
            if (tipo === 'compradores') {
                const compradores = Object.entries(data.analytics.porCliente ?? {}).map(([id, d]) => ({ id, ...d })).filter(c => c.compras > 0).sort((a, b) => por === 'robux' ? b.robux - a.robux : b.compras - a.compras).slice(0, 10);
                if (compradores.length === 0) return safeReply(interaction, { content: '📭 Sin compras aún.' });
                return safeReply(interaction, { content: '', embeds: [new EmbedBuilder().setColor('#FEE75C').setTitle('👑  Top compradores').setDescription(compradores.map((c, i) => `> ${medallas[i] ?? `**${i + 1}.**`} <@${c.id}> — \`${c.compras}\` compra(s) • \`${formatRobux(c.robux)}\``).join('\n')).setTimestamp()] });
            }
            const vendedores = Object.entries(data.analytics.porVendedor).map(([id, d]) => ({ id, ...d })).filter(v => v.ventas > 0).sort((a, b) => por === 'robux' ? b.robux - a.robux : b.ventas - a.ventas).slice(0, 10);
            if (vendedores.length === 0) return safeReply(interaction, { content: '📭 Sin pedidos aún.' });
            return safeReply(interaction, { content: '', embeds: [new EmbedBuilder().setColor('#57F287').setTitle('🏆  Top operadores').setDescription(vendedores.map((v, i) => `> ${medallas[i] ?? `**${i + 1}.**`} <@${v.id}> — \`${v.ventas}\` pedido(s) • \`${formatRobux(v.robux)}\``).join('\n')).setTimestamp()] });
        }

        // /dashboard
        if (interaction.commandName === 'dashboard') {
            const hoy    = ventasPorRango(data.ventas, 'hoy').filter(v => v.estado !== 'cancelada');
            const semana = ventasPorRango(data.ventas, 'semana').filter(v => v.estado !== 'cancelada');
            const mes    = ventasPorRango(data.ventas, 'mes').filter(v => v.estado !== 'cancelada');
            const topV   = Object.entries(data.analytics.porVendedor).sort((a, b) => b[1].ventas - a[1].ventas)[0];
            const topC   = data.analytics.porCliente ? Object.entries(data.analytics.porCliente).sort((a, b) => b[1].compras - a[1].compras)[0] : null;
            const totalR = data.resenas?.length ?? 0;
            const prom   = totalR > 0 ? (data.resenas.reduce((s, r) => s + r.estrellas, 0) / totalR).toFixed(1) : null;
            return safeReply(interaction, { content: '', embeds: [new EmbedBuilder().setColor('#5865F2').setTitle(`📈  Dashboard — ${guild.name}`).setThumbnail(guild.iconURL({ dynamic: true }) ?? null)
                .setDescription(`> 🌅  **Hoy:**         \`${hoy.length}\` pedidos • \`${formatRobux(hoy.reduce((s, v) => s + v.robux, 0))}\`\n> 📅  **Esta semana:** \`${semana.length}\` pedidos • \`${formatRobux(semana.reduce((s, v) => s + v.robux, 0))}\`\n> 🗓️  **Este mes:**    \`${mes.length}\` pedidos • \`${formatRobux(mes.reduce((s, v) => s + v.robux, 0))}\`\n> 📦  **Histórico:**   \`${data.analytics.totalVentas}\` pedidos • \`${formatRobux(data.analytics.totalRobux)}\`\n\n> 🏆  **Top operador:** ${topV ? `<@${topV[0]}> (\`${topV[1].ventas}\` pedidos)` : '`Sin datos`'}\n> 👑  **Top cliente:**  ${topC ? `<@${topC[0]}> (\`${topC[1].compras}\` compras)` : '`Sin datos`'}${prom ? `\n> ⭐  **Valoración:**  \`${prom}/5\` *(${totalR} reseñas)*` : ''}`)
                .setFooter({ text: 'Aurex' }).setTimestamp()] });
        }

        // /afk
        if (interaction.commandName === 'afk') {
            const motivo = interaction.options.getString('motivo') ?? 'Sin motivo';
            data.afk[user.id] = { motivo, tiempo: Date.now(), menciones: [] };
            saveData(guild.id, data);
            return safeReply(interaction, { content: '', embeds: [new EmbedBuilder().setColor('#3498DB').setDescription(`### 💤  AFK activado\n\n> **${user.username}** — *${motivo}*`)] });
        }

        // /anuncio
        if (interaction.commandName === 'anuncio') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) return safeReply(interaction, { content: '🚫 Necesitas permiso de **Gestionar mensajes**.' });
            const titulo = interaction.options.getString('titulo');
            const cuerpo = interaction.options.getString('mensaje');
            const textoBoton  = interaction.options.getString('texto_boton');
            const enlaceBoton = interaction.options.getString('enlace_boton');
            const embed = new EmbedBuilder().setColor('#ED4245').setTitle(`📢  ${titulo}`).setDescription(cuerpo).setFooter({ text: `Anuncio por ${user.tag} · Aurex` }).setTimestamp();
            const opts = { embeds: [embed] };
            if (textoBoton && enlaceBoton) opts.components = [new ActionRowBuilder().addComponents(new ButtonBuilder().setLabel(textoBoton).setURL(enlaceBoton).setStyle(ButtonStyle.Link))];
            await safeReply(interaction, { content: '✅ Anuncio enviado.' });
            return interaction.channel.send(opts).catch(() => {});
        }

        // /clear
        if (interaction.commandName === 'clear') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) return safeReply(interaction, { content: '🚫 Necesitas permiso de **Gestionar mensajes**.' });
            const cantidad = interaction.options.getInteger('cantidad');
            if (cantidad < 1 || cantidad > 100) return safeReply(interaction, { content: '⚠️ Entre 1 y 100.' });
            const deleted = await interaction.channel.bulkDelete(cantidad, true).catch(() => null);
            return safeReply(interaction, { content: `🗑️ **${deleted?.size ?? 0}** mensaje(s) eliminados.` });
        }

        // /setlog
        if (interaction.commandName === 'setlog') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) return safeReply(interaction, { content: '🚫 Solo administradores.' });
            data.config.logChannelId = interaction.options.getChannel('canal').id;
            saveData(guild.id, data);
            return safeReply(interaction, { content: `✅ Canal de logs: <#${data.config.logChannelId}>` });
        }

        // /setresenas
        if (interaction.commandName === 'setresenas') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) return safeReply(interaction, { content: '🚫 Solo administradores.' });
            data.config.resenaChannelId = interaction.options.getChannel('canal').id;
            saveData(guild.id, data);
            return safeReply(interaction, { content: `✅ Canal de reseñas: <#${data.config.resenaChannelId}>` });
        }

        // /configdm
        if (interaction.commandName === 'configdm') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) return safeReply(interaction, { content: '🚫 Solo administradores.' });
            data.config.dmEnabled = interaction.options.getBoolean('estado');
            saveData(guild.id, data);
            return safeReply(interaction, { content: `✅ DMs: **${data.config.dmEnabled ? 'activados ✅' : 'desactivados ❌'}**` });
        }

        // /setdm
        if (interaction.commandName === 'setdm') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) return safeReply(interaction, { content: '🚫 Solo administradores.' });
            const texto = interaction.options.getString('texto');
            data.config.dmCierreTexto = texto;
            saveData(guild.id, data);
            return safeReply(interaction, { content: '', embeds: [new EmbedBuilder().setColor('#57F287').setTitle('✅  Mensaje de cierre actualizado').setDescription(`> ${texto.replace(/\n/g, '\n> ')}\n\n*Variables: \`{usuario}\` \`{servidor}\`*`)] });
        }

        // /stock
        if (interaction.commandName === 'stock') {
            const stock = data.stock ?? [];
            if (stock.length === 0) return safeReply(interaction, { content: '📭 El stock está vacío.' });
            const lineas = stock.map(item => `> 📦  **${item.nombre}**\n> ├ 🔢 Cantidad: \`${item.cantidad}\`\n> ├ 💵 Precio:   \`${item.precio ?? 'No especificado'}\`\n> └ 📝 Notas:    \`${item.notas ?? '—'}\``).join('\n\n');
            return safeReply(interaction, { content: '', embeds: [new EmbedBuilder().setColor('#5865F2').setTitle('📦  Stock disponible').setDescription(lineas).setFooter({ text: `${stock.length} ítem(s) • ${guild.name} · Aurex` }).setTimestamp()] });
        }

        // /stock-admin
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
                return safeReply(interaction, { content: '', embeds: [new EmbedBuilder().setColor('#57F287').setTitle('✅  Ítem agregado').setDescription(`> 📦  **${nombre}** — Cantidad: \`${cantidad ?? 0}\` — Precio: \`${precio ?? 'No especificado'}\``)] });
            }
            if (accion === 'editar') {
                const idx = data.stock.findIndex(i => i.nombre.toLowerCase() === nombre?.toLowerCase());
                if (idx === -1) return safeReply(interaction, { content: `⚠️ No existe \`${nombre}\`.` });
                if (cantidad !== null) data.stock[idx].cantidad = cantidad;
                if (precio   !== null) data.stock[idx].precio   = precio;
                if (notas    !== null) data.stock[idx].notas    = notas;
                saveData(guild.id, data);
                return safeReply(interaction, { content: `✅ \`${data.stock[idx].nombre}\` actualizado.` });
            }
            if (accion === 'eliminar') {
                const idx = data.stock.findIndex(i => i.nombre.toLowerCase() === nombre?.toLowerCase());
                if (idx === -1) return safeReply(interaction, { content: `⚠️ No existe \`${nombre}\`.` });
                data.stock.splice(idx, 1);
                saveData(guild.id, data);
                return safeReply(interaction, { content: `🗑️ **${nombre}** eliminado del stock.` });
            }
            if (accion === 'limpiar') {
                data.stock = [];
                saveData(guild.id, data);
                return safeReply(interaction, { content: '🗑️ Stock limpiado.' });
            }
        }

        // /stock-bulk — Ahora abre un MODAL para pegar los ítems cómodamente
        if (interaction.commandName === 'stock-bulk') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) return safeReply(interaction, { content: '🚫 Solo administradores.' });

            const modal = new ModalBuilder()
                .setCustomId('stock_bulk_modal')
                .setTitle('📦 Carga masiva de stock');

            modal.addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('items_texto')
                        .setLabel('Ítems (uno por línea)')
                        .setStyle(TextInputStyle.Paragraph)
                        .setPlaceholder(
                            'Nombre | cantidad | precio | notas\n' +
                            'Ejemplo:\n' +
                            'Robux 1000 | 10 | $5 USD | Entrega inmediata\n' +
                            'Cuenta Premium | 3 | $15 USD\n' +
                            'Servicio X | 5'
                        )
                        .setRequired(true)
                        .setMaxLength(3000)
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('modo_valor')
                        .setLabel('Modo: "agregar" o "reemplazar"')
                        .setStyle(TextInputStyle.Short)
                        .setPlaceholder('agregar')
                        .setRequired(false)
                        .setMaxLength(10)
                )
            );

            return interaction.showModal(modal);
        }
    });
});

client.login(process.env.TOKEN);