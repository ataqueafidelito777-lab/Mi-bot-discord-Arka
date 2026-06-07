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
//  BANNER — URL pública de tu imagen de Aurex
//  Reemplaza esta URL por el link directo a tu
//  imagen subida a imgur.com o similar
// ─────────────────────────────────────────────
const BANNER_URL = 'https://i.imgur.com/REEMPLAZA.png';

// ─────────────────────────────────────────────
//  PERSISTENCIA
// ─────────────────────────────────────────────
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

function loadData(guildId) {
    const file = path.join(DATA_DIR, `${guildId}.json`);
    if (!fs.existsSync(file)) return defaultData();
    try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
    catch { return defaultData(); }
}
function saveData(guildId, data) {
    const file = path.join(DATA_DIR, `${guildId}.json`);
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}
function defaultData() {
    return {
        ventas: [],
        resenas: [],
        config: {
            logChannelId:    null,
            dmEnabled:       true,
            resenaChannelId: null,
            dmCierreTexto:   null
        },
        afk:      {},
        stock:    [],
        analytics: { totalVentas: 0, totalRobux: 0, porVendedor: {}, porCliente: {} }
    };
}

// tickets_<guildId>.json — separado por servidor
function loadTickets(guildId) {
    const file = path.join(DATA_DIR, `tickets_${guildId}.json`);
    if (!fs.existsSync(file)) return defaultTickets();
    try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
    catch { return defaultTickets(); }
}
function saveTickets(guildId, data) {
    const file = path.join(DATA_DIR, `tickets_${guildId}.json`);
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}
function defaultTickets() {
    return {
        tickets: [],
        config: {
            panelMessageId:  null,   // ← ID del mensaje del panel (evita duplicados)
            panelChannelId:  null,   // ← canal donde está el panel
            categoryId:      null,
            logChannelId:    null,
            vendedorRoleId:  null,
            staffRoleId:     null
        }
    };
}

// ─────────────────────────────────────────────
//  COOLDOWNS
// ─────────────────────────────────────────────
const cooldowns = new Map();
function checkCooldown(guildId, userId, comando, segundos) {
    const key   = `${guildId}-${userId}-${comando}`;
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
    return new Date().toLocaleString('es-MX', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
}
function ventasPorRango(ventas, rango) {
    const ahora  = Date.now();
    const rangos = { hoy: 86_400_000, semana: 604_800_000, mes: 2_592_000_000 };
    const ms     = rangos[rango] ?? Infinity;
    return ventas.filter(v => (ahora - v.timestamp) <= ms);
}
function tiempoRelativo(ms) {
    const min  = Math.floor(ms / 60000);
    const hrs  = Math.floor(min / 60);
    const dias = Math.floor(hrs / 24);
    if (dias > 0) return `${dias}d ${hrs % 24}h`;
    if (hrs > 0)  return `${hrs}h ${min % 60}m`;
    return `${min}m`;
}
function estrellas(n) { return '⭐'.repeat(Math.min(n, 5)); }
function calcDuracion(start, end) {
    const ms   = end - start;
    const min  = Math.floor(ms / 60000);
    const hrs  = Math.floor(min / 60);
    const dias = Math.floor(hrs / 24);
    if (dias > 0) return `${dias}d ${hrs % 24}h`;
    if (hrs > 0)  return `${hrs}h ${min % 60}m`;
    return `${min}m`;
}

// ─────────────────────────────────────────────
//  EMBEDS DE VENTAS
// ─────────────────────────────────────────────
function buildLogEmbed(venta, numeroOrden) {
    return new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('🛒  Nueva orden registrada')
        .setDescription(
            `> **\`#${numeroOrden}\`** — ${venta.producto}\n` +
            `> ━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `> 💎  **Cantidad:** \`${formatRobux(venta.robux)}\`\n` +
            `> 💵  **Precio:**   \`${venta.precio ?? 'No especificado'}\`\n` +
            `> 💳  **Método:**   \`${venta.metodo}\`\n` +
            `> ━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `> 👤  **Cliente:**  <@${venta.clienteId}>\n` +
            `> 🤝  **Operador:** <@${venta.vendedorId}>`
        )
        .setFooter({ text: `Aurex • ${today()}` })
        .setTimestamp();
}
function buildDMEmbed(venta, numeroOrden, guildName) {
    return new EmbedBuilder()
        .setColor('#57F287')
        .setTitle('✅  Pedido confirmado')
        .setDescription(
            `¡Hola! Tu pedido en **${guildName}** fue registrado exitosamente.\n\n` +
            `> 📦  **Producto:** \`${venta.producto}\`\n` +
            `> 💎  **Cantidad:** \`${formatRobux(venta.robux)}\`\n` +
            `> 💵  **Precio:**   \`${venta.precio ?? 'No especificado'}\`\n` +
            `> 💳  **Método:**   \`${venta.metodo}\`\n` +
            `> 🔖  **Orden:**    \`#${numeroOrden}\`\n\n` +
            `*Guarda este número por si necesitas hacer seguimiento.*`
        )
        .setFooter({ text: `${guildName} · powered by Aurex` })
        .setTimestamp();
}
function buildVentaPublicaEmbed(venta, numeroOrden) {
    return new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle(`🧾  Orden \`#${numeroOrden}\``)
        .setDescription(
            `> 📦  **Producto:** \`${venta.producto}\`\n` +
            `> 💎  **Cantidad:** \`${formatRobux(venta.robux)}\`\n` +
            `> 💵  **Precio:**   \`${venta.precio ?? 'No especificado'}\`\n` +
            `> 💳  **Método:**   \`${venta.metodo}\`\n` +
            `> ━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `> 👤  **Cliente:**  <@${venta.clienteId}>\n` +
            `> 🤝  **Operador:** <@${venta.vendedorId}>`
        )
        .setFooter({ text: `✅ Registrado • ${today()} • Aurex` })
        .setTimestamp();
}

// ─────────────────────────────────────────────
//  HELP EMBED
// ─────────────────────────────────────────────
function buildHelpEmbed() {
    return new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('📖  Comandos de Aurex')
        .setDescription(
            `**💸 Pedidos**\n` +
            `\`/vender\` \`/historial\` \`/orden\` \`/buscar\` \`/cancelar\` \`/exportar\`\n\n` +
            `**📊 Analíticas**\n` +
            `\`/stats\` \`/top\` \`/dashboard\` \`/perfil\`\n\n` +
            `**📦 Stock**\n` +
            `\`/stock\` — Ver stock disponible\n` +
            `\`/stock-admin\` — Gestionar stock *(solo admins)*\n\n` +
            `**⭐ Reputación**\n` +
            `\`/reseña\` \`/resenas\`\n\n` +
            `**🔧 Utilidades**\n` +
            `\`/afk\` \`/anuncio\` \`/clear\` \`/ping\`\n\n` +
            `**⚙️ Configuración** *(solo admins)*\n` +
            `\`/setlog\` \`/setresenas\` \`/configdm\` \`/setdm\`\n\n` +
            `**🎫 Tickets**\n` +
            `\`/ticket-setup\` — Configura el panel de tickets`
        )
        .setFooter({ text: 'Aurex • /help' })
        .setTimestamp();
}

// ─────────────────────────────────────────────
//  TICKETS — CATEGORÍAS
// ─────────────────────────────────────────────
const CATEGORIAS = {
    comprar: {
        emoji:       '🛒',
        label:       'Comprar',
        descripcion: '¿Interesado en adquirir productos o servicios?',
        prefijo:     'compra',
        color:       '#57F287',
        bienvenida:  (username) =>
            `### 🛒  Ticket de Compra\n` +
            `> ¡Hola, **${username}**! Bienvenido a tu ticket de compra.\n` +
            `> Un operador te atenderá en breve.\n\n` +
            `**📋 Para agilizar tu pedido, cuéntanos:**\n` +
            `> 💎  ¿Qué cantidad deseas adquirir?\n` +
            `> 💵  ¿Cuál es tu presupuesto?\n` +
            `> 💳  ¿Cuál es tu método de pago?\n` +
            `> 🌎  ¿De qué país eres?`,
        modal: true
    },
    soporte: {
        emoji:       '🎧',
        label:       'Soporte',
        descripcion: '¿Tienes una duda, problema o inconveniente?',
        prefijo:     'soporte',
        color:       '#3498DB',
        bienvenida:  (username) =>
            `### 🎧  Ticket de Soporte\n` +
            `> ¡Hola, **${username}**! Abriste un ticket de soporte.\n` +
            `> Nuestro equipo revisará tu caso lo antes posible.\n\n` +
            `**📋 Para ayudarte mejor, necesitamos:**\n` +
            `> ❓  ¿Qué ocurrió exactamente?\n` +
            `> 🔖  ¿Tienes número de orden? *(si aplica)*\n` +
            `> 📸  ¿Tienes capturas de pantalla como evidencia?`,
        modal: false
    },
    reporte: {
        emoji:       '⚠️',
        label:       'Reporte',
        descripcion: '¿Necesitas reportar a alguien o algo?',
        prefijo:     'reporte',
        color:       '#ED4245',
        bienvenida:  (username) =>
            `### ⚠️  Ticket de Reporte\n` +
            `> ¡Hola, **${username}**! Recibimos tu reporte.\n` +
            `> El staff lo revisará con la mayor seriedad posible.\n\n` +
            `**📋 Para procesar tu reporte necesitamos:**\n` +
            `> 👤  Usuario reportado *(tag o ID)*\n` +
            `> 📝  Motivo del reporte detallado\n` +
            `> 📸  Evidencia *(capturas, videos, links)*\n` +
            `> 📅  ¿Cuándo ocurrió el incidente?`,
        modal: false
    },
    otros: {
        emoji:       'ℹ️',
        label:       'Otros',
        descripcion: '¿Otra consulta que no encaja en las opciones?',
        prefijo:     'otros',
        color:       '#95A5A6',
        bienvenida:  (username) =>
            `### ℹ️  Ticket General\n` +
            `> ¡Hola, **${username}**! Abriste un ticket de consulta general.\n` +
            `> Un miembro del staff te atenderá en breve.\n\n` +
            `**📋 Para ayudarte, cuéntanos:**\n` +
            `> ✏️  ¿En qué podemos ayudarte hoy?\n` +
            `> 📎  Agrega cualquier detalle o archivo relevante.`,
        modal: false
    }
};

// ─────────────────────────────────────────────
//  TICKETS — PANEL EMBED (reutilizable)
// ─────────────────────────────────────────────
function buildPanelEmbed(guildName) {
    return new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('🎫  ¿En qué podemos ayudarte?')
        .setDescription(
            `> Selecciona la opción que mejor se ajuste a tu necesidad.\n` +
            `> Un miembro de nuestro equipo te atenderá en breve.\n\n` +
            `**🛒  Comprar**\n` +
            `> ¿Estás interesado en adquirir alguno de nuestros productos?\n\n` +
            `**🎧  Soporte**\n` +
            `> ¿Tienes alguna duda, inconveniente o problema?\n\n` +
            `**⚠️  Reporte**\n` +
            `> ¿Necesitas reportar a un usuario o situación al staff?\n\n` +
            `**ℹ️  Otros**\n` +
            `> ¿Otra consulta que no encaja en las opciones anteriores?`
        )
        .setImage(BANNER_URL)
        .setFooter({ text: `${guildName} · powered by Aurex` })
        .setTimestamp();
}

function buildPanelRow() {
    return new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('ticket_categoria')
            .setPlaceholder('Selecciona una opción...')
            .addOptions(
                Object.entries(CATEGORIAS).map(([key, cat]) =>
                    new StringSelectMenuOptionBuilder()
                        .setLabel(cat.label)
                        .setDescription(cat.descripcion)
                        .setEmoji(cat.emoji)
                        .setValue(key)
                )
            )
    );
}

// ─────────────────────────────────────────────
//  TICKETS — SETUP
//  FIX: Un solo panel por servidor.
//  Si ya existe, edita el mensaje existente
//  en lugar de enviar uno nuevo.
// ─────────────────────────────────────────────
async function handleTicketSetup(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator))
        return interaction.reply({ content: '🚫 Solo administradores.', ephemeral: true });

    await interaction.deferReply({ ephemeral: true });

    const tdata            = loadTickets(interaction.guild.id);
    const canal            = interaction.options.getChannel('canal');
    const categoriaDiscord = interaction.options.getChannel('categoria') ?? null;
    const logCanal         = interaction.options.getChannel('logs')      ?? null;
    const vendedorRol      = interaction.options.getRole('rol_vendedor') ?? null;
    const staffRol         = interaction.options.getRole('rol_staff')    ?? null;

    // Actualizar config
    tdata.config.categoryId     = categoriaDiscord?.id ?? tdata.config.categoryId;
    tdata.config.logChannelId   = logCanal?.id         ?? tdata.config.logChannelId;
    tdata.config.vendedorRoleId = vendedorRol?.id      ?? tdata.config.vendedorRoleId;
    tdata.config.staffRoleId    = staffRol?.id         ?? tdata.config.staffRoleId;

    const embedPanel = buildPanelEmbed(interaction.guild.name);
    const rowPanel   = buildPanelRow();

    // ── Si ya existe un panel, intentar editarlo ──────────────────────────
    let panelActualizado = false;
    if (tdata.config.panelMessageId && tdata.config.panelChannelId) {
        try {
            const canalAnterior = await interaction.guild.channels.fetch(tdata.config.panelChannelId).catch(() => null);
            if (canalAnterior) {
                const mensajeAnterior = await canalAnterior.messages.fetch(tdata.config.panelMessageId).catch(() => null);
                if (mensajeAnterior) {
                    await mensajeAnterior.edit({ embeds: [embedPanel], components: [rowPanel] });
                    panelActualizado = true;

                    // Si se cambió de canal, mover el panel (eliminar y reenviar)
                    if (canalAnterior.id !== canal.id) {
                        await mensajeAnterior.delete().catch(() => {});
                        panelActualizado = false; // forzar reenvío al nuevo canal
                    }
                }
            }
        } catch {
            panelActualizado = false;
        }
    }

    // ── Si no existe o se cambió de canal, enviar nuevo panel ────────────
    if (!panelActualizado) {
        const mensajeNuevo = await canal.send({ embeds: [embedPanel], components: [rowPanel] });
        tdata.config.panelMessageId = mensajeNuevo.id;
        tdata.config.panelChannelId = canal.id;
    }

    saveTickets(interaction.guild.id, tdata);

    const resumen = [
        `✅ Panel de tickets ${panelActualizado ? 'actualizado' : `enviado a <#${canal.id}>`}`,
        categoriaDiscord ? `📁 Categoría: **${categoriaDiscord.name}**`   : '',
        logCanal         ? `📋 Logs: <#${logCanal.id}>`                   : '',
        vendedorRol      ? `💼 Rol vendedor: <@&${vendedorRol.id}>`       : '',
        staffRol         ? `🛡️ Rol staff: <@&${staffRol.id}>`             : ''
    ].filter(Boolean).join('\n');

    return interaction.editReply({ content: resumen });
}

// ─────────────────────────────────────────────
//  TICKETS — ABRIR
//  FIX: Un solo ticket activo por usuario
//  sin importar la categoría.
//  FIX: Si el canal fue eliminado manualmente,
//  se limpia el ticket huérfano y se permite abrir uno nuevo.
// ─────────────────────────────────────────────
async function abrirTicket(interaction, categoriaKey, datosModal = null) {
    const guild = interaction.guild;
    const user  = interaction.user;
    const tdata = loadTickets(guild.id);
    const cat   = CATEGORIAS[categoriaKey];

    // ── Verificar si ya tiene UN ticket abierto (cualquier categoría) ─────
    const ticketAbierto = tdata.tickets.find(t => t.userId === user.id && t.estado === 'abierto');
    if (ticketAbierto) {
        // Verificar si el canal aún existe
        const canalExistente = guild.channels.cache.get(ticketAbierto.channelId)
            ?? await guild.channels.fetch(ticketAbierto.channelId).catch(() => null);

        if (canalExistente) {
            // Canal existe — bloquear y redirigir
            return interaction.reply({
                content:
                    `⚠️ Ya tienes un ticket abierto: <#${ticketAbierto.channelId}>\n` +
                    `Debes cerrarlo antes de abrir uno nuevo.`,
                ephemeral: true
            });
        } else {
            // Canal fue eliminado manualmente — limpiar ticket huérfano
            ticketAbierto.estado    = 'cerrado';
            ticketAbierto.cerradoPor = 'Sistema (canal eliminado)';
            ticketAbierto.cerradoAt  = Date.now();
            saveTickets(guild.id, tdata);
            // Continuar y permitir abrir nuevo ticket
        }
    }

    // ── Crear canal del ticket ────────────────────────────────────────────
    const nombreCanal = `${cat.prefijo}-${user.username.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20)}`;

    const permisos = [
        { id: guild.id,  deny:  [PermissionFlagsBits.ViewChannel] },
        { id: user.id,   allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }
    ];
    if (tdata.config.staffRoleId) {
        permisos.push({
            id:    tdata.config.staffRoleId,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageMessages]
        });
    }
    if (categoriaKey === 'comprar' && tdata.config.vendedorRoleId) {
        permisos.push({
            id:    tdata.config.vendedorRoleId,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
        });
    }

    const canalTicket = await guild.channels.create({
        name:                 nombreCanal,
        type:                 ChannelType.GuildText,
        parent:               tdata.config.categoryId ?? null,
        permissionOverwrites: permisos
    });

    const ticketId = tdata.tickets.length + 1;
    tdata.tickets.push({
        id:        ticketId,
        channelId: canalTicket.id,
        userId:    user.id,
        userTag:   user.tag,
        categoria: categoriaKey,
        estado:    'abierto',
        timestamp: Date.now(),
        datosModal
    });
    saveTickets(guild.id, tdata);

    // ── Mensaje de bienvenida ─────────────────────────────────────────────
    let descripcion = cat.bienvenida(user.username);
    if (datosModal) {
        descripcion +=
            `\n\n**📋 Datos de tu pedido:**\n` +
            `> 💎  **Cantidad:**    \`${datosModal.cantidad}\`\n` +
            `> 💵  **Presupuesto:** \`${datosModal.precio}\`\n` +
            `> 💳  **Método:**      \`${datosModal.metodo}\``;
    }

    const embedBienvenida = new EmbedBuilder()
        .setColor(cat.color)
        .setImage(BANNER_URL)
        .setDescription(descripcion)
        .setFooter({ text: `Ticket #${ticketId} • ${guild.name} · Aurex` })
        .setTimestamp();

    const rowCerrar = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`ticket_cerrar_${ticketId}`)
            .setLabel('🔒 Cerrar ticket')
            .setStyle(ButtonStyle.Danger)
    );

    const menciones = [`<@${user.id}>`];
    if (categoriaKey === 'comprar' && tdata.config.vendedorRoleId) {
        menciones.push(`<@&${tdata.config.vendedorRoleId}>`);
    } else if (tdata.config.staffRoleId) {
        menciones.push(`<@&${tdata.config.staffRoleId}>`);
    }

    await canalTicket.send({ content: menciones.join(' '), embeds: [embedBienvenida], components: [rowCerrar] });

    return interaction.reply({
        content: `✅ Tu ticket fue creado: <#${canalTicket.id}>`,
        ephemeral: true
    });
}

// ─────────────────────────────────────────────
//  TICKETS — CERRAR
// ─────────────────────────────────────────────
async function cerrarTicket(interaction, ticketId) {
    const guild  = interaction.guild;
    const tdata  = loadTickets(guild.id);
    const ticket = tdata.tickets.find(t => t.id === ticketId);

    if (!ticket || ticket.estado === 'cerrado')
        return interaction.reply({ content: '⚠️ Este ticket ya fue cerrado.', ephemeral: true });

    const esAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
    const esStaff = tdata.config.staffRoleId
        ? interaction.member.roles.cache.has(tdata.config.staffRoleId)
        : false;
    const esDueño = interaction.user.id === ticket.userId;

    if (!esAdmin && !esStaff && !esDueño)
        return interaction.reply({ content: '🚫 No tienes permiso para cerrar este ticket.', ephemeral: true });

    await interaction.deferReply();

    // Transcript
    const mensajes  = await interaction.channel.messages.fetch({ limit: 100 });
    const cat       = CATEGORIAS[ticket.categoria];
    let transcript  = `TRANSCRIPT — Ticket #${ticket.id} (${cat.label})\n`;
    transcript     += `Usuario: ${ticket.userTag}\n`;
    transcript     += `Cerrado por: ${interaction.user.tag}\n`;
    transcript     += `Fecha: ${new Date().toLocaleString('es-MX')}\n`;
    transcript     += `Duración: ${calcDuracion(ticket.timestamp, Date.now())}\n`;
    transcript     += `${'─'.repeat(60)}\n\n`;
    mensajes.reverse().forEach(m => {
        if (m.author.bot) return;
        transcript += `[${new Date(m.createdTimestamp).toLocaleString('es-MX')}] ${m.author.tag}: ${m.content}\n`;
        if (m.embeds.length > 0) transcript += `  [embed adjunto]\n`;
    });

    ticket.estado     = 'cerrado';
    ticket.cerradoPor = interaction.user.tag;
    ticket.cerradoAt  = Date.now();
    saveTickets(guild.id, tdata);

    const embedCierre = new EmbedBuilder()
        .setColor('#ED4245')
        .setTitle('🔒  Ticket cerrado')
        .setDescription(
            `> Cerrado por <@${interaction.user.id}>\n` +
            `> El canal será eliminado en **5 segundos**.\n\n` +
            `*El transcript fue enviado a tu DM.*`
        )
        .setTimestamp();

    await interaction.editReply({ embeds: [embedCierre] });

    // DM al usuario
    try {
        const gdata   = loadData(guild.id);
        const dmTexto = gdata.config.dmCierreTexto ??
            `¡Hola, **{usuario}**! 👋\n\nEsperamos haberte atendido de la mejor manera en **{servidor}**.\n\n> *Si tuviste algún inconveniente, no dudes en abrir un nuevo ticket.*\n\n¡Gracias por confiar en nosotros! 💙`;

        const mensajeFinal = dmTexto
            .replace('{usuario}', ticket.userTag)
            .replace('{servidor}', guild.name);

        const embedDM = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle('🎫  Tu ticket fue cerrado')
            .setDescription(
                `> **Servidor:**    \`${guild.name}\`\n` +
                `> **Categoría:**   ${cat.emoji} \`${cat.label}\`\n` +
                `> **Cerrado por:** \`${interaction.user.tag}\`\n` +
                `> **Duración:**    \`${calcDuracion(ticket.timestamp, Date.now())}\`\n\n` +
                `━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                mensajeFinal
            )
            .setFooter({ text: `${guild.name} · powered by Aurex` })
            .setTimestamp();

        const buffer   = Buffer.from(transcript, 'utf8');
        const filename = `transcript-ticket${ticketId}.txt`;
        const miembro  = guild.members.cache.get(ticket.userId)
            ?? await guild.members.fetch(ticket.userId).catch(() => null);
        if (miembro) await miembro.send({ embeds: [embedDM], files: [{ attachment: buffer, name: filename }] });
    } catch {
        console.warn(`No se pudo enviar DM de cierre a ${ticket.userTag}`);
    }

    // Log de tickets
    if (tdata.config.logChannelId) {
        const logCanal = guild.channels.cache.get(tdata.config.logChannelId);
        if (logCanal) {
            const embedLog = new EmbedBuilder()
                .setColor('#5865F2')
                .setTitle(`📋  Ticket #${ticketId} cerrado`)
                .setDescription(
                    `> 👤  **Usuario:**    <@${ticket.userId}> (\`${ticket.userTag}\`)\n` +
                    `> 🗂️  **Categoría:**  ${cat.emoji} \`${cat.label}\`\n` +
                    `> 🔒  **Cerrado por:** \`${interaction.user.tag}\`\n` +
                    `> ⏱️  **Duración:**   \`${calcDuracion(ticket.timestamp, Date.now())}\``
                )
                .setTimestamp();
            const buffer   = Buffer.from(transcript, 'utf8');
            const filename = `transcript-ticket${ticketId}.txt`;
            await logCanal.send({ embeds: [embedLog], files: [{ attachment: buffer, name: filename }] });
        }
    }

    setTimeout(() => { interaction.channel.delete().catch(() => {}); }, 5000);
}

// ─────────────────────────────────────────────
//  TICKETS — HANDLER CENTRAL
// ─────────────────────────────────────────────
async function handleTicketInteraction(interaction) {
    // Select menu — elegir categoría
    if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_categoria') {
        const categoriaKey = interaction.values[0];
        const cat          = CATEGORIAS[categoriaKey];
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
            return interaction.showModal(modal);
        }
        return abrirTicket(interaction, categoriaKey);
    }

    // Modal submit — datos de compra
    if (interaction.isModalSubmit() && interaction.customId.startsWith('ticket_modal_')) {
        const categoriaKey = interaction.customId.replace('ticket_modal_', '');
        const datosModal   = {
            cantidad: interaction.fields.getTextInputValue('cantidad'),
            precio:   interaction.fields.getTextInputValue('precio'),
            metodo:   interaction.fields.getTextInputValue('metodo')
        };
        return abrirTicket(interaction, categoriaKey, datosModal);
    }

    // Botón cerrar
    if (interaction.isButton() && interaction.customId.startsWith('ticket_cerrar_')) {
        const ticketId = parseInt(interaction.customId.replace('ticket_cerrar_', ''));
        return cerrarTicket(interaction, ticketId);
    }
}

// ─────────────────────────────────────────────
//  CLIENTE
// ─────────────────────────────────────────────
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

client.once('ready', () => {
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

    // AFK: regreso
    if (data.afk[message.author.id]) {
        const afkData   = data.afk[message.author.id];
        const duracion  = tiempoRelativo(Date.now() - afkData.tiempo);
        const menciones = afkData.menciones ?? [];
        delete data.afk[message.author.id];
        saveData(message.guild.id, data);

        let desc = `### 👋  ¡Bienvenido de vuelta!\n\n> Removí tu AFK. Estuviste ausente **${duracion}**`;
        if (menciones.length > 0) {
            const lista = menciones
                .map(m => `> • **[${m.tag}](${m.url})** — <t:${Math.floor(m.timestamp / 1000)}:R>`)
                .join('\n');
            desc += `\n\n**📬 Te mencionaron (${menciones.length}):**\n${lista}`;
        }
        const embed = new EmbedBuilder().setColor('#57F287').setDescription(desc).setTimestamp();
        await message.reply({ embeds: [embed] });
        return;
    }

    // AFK: registrar mención
    if (message.mentions.users.size > 0) {
        for (const [, usuario] of message.mentions.users) {
            if (data.afk[usuario.id] && message.author.id !== usuario.id) {
                const afkInfo = data.afk[usuario.id];
                if (!afkInfo.menciones) afkInfo.menciones = [];
                afkInfo.menciones.push({
                    tag: message.author.tag, userId: message.author.id,
                    url: message.url, timestamp: Date.now()
                });
                saveData(message.guild.id, data);
                const min = tiempoRelativo(Date.now() - afkInfo.tiempo);
                const embed = new EmbedBuilder().setColor('#ED4245')
                    .setDescription(
                        `> 💤  **${usuario.username}** está AFK hace **${min}**\n` +
                        `> *Motivo: ${afkInfo.motivo}*\n\n` +
                        `Tu mención fue registrada y la verá al volver.`
                    );
                await message.reply({ embeds: [embed] });
            }
        }
    }

    // Tagear al bot
    if (message.mentions.has(client.user)) {
        const embed = new EmbedBuilder().setColor('#5865F2')
            .setDescription(`### 👋  ¡Hola!\n\n> Usa \`/help\` para ver todos mis comandos.`);
        return message.reply({ embeds: [embed] });
    }

    if (!message.content.startsWith(PREFIX)) return;
    const args        = message.content.slice(PREFIX.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();
    if (commandName === 'ping') return message.reply(`🏓 Pong! \`${Math.round(client.ws.ping)}ms\``);
    if (commandName === 'help') return message.reply({ embeds: [buildHelpEmbed()] });
    if (commandName === 'afk') {
        const motivo = args.join(' ') || 'Sin motivo';
        data.afk[message.author.id] = { motivo, tiempo: Date.now(), menciones: [] };
        saveData(message.guild.id, data);
        const embed = new EmbedBuilder().setColor('#3498DB')
            .setDescription(`### 💤  AFK activado\n\n> **${message.author.username}** — *${motivo}*`);
        return message.reply({ embeds: [embed] });
    }
});

// ─────────────────────────────────────────────
//  INTERACCIONES
// ─────────────────────────────────────────────
client.on('interactionCreate', async (interaction) => {

    // ── Tickets ───────────────────────────────────────────────────────────
    if (
        (interaction.isStringSelectMenu() && interaction.customId === 'ticket_categoria') ||
        (interaction.isModalSubmit()      && interaction.customId.startsWith('ticket_modal_')) ||
        (interaction.isButton()           && interaction.customId.startsWith('ticket_cerrar_'))
    ) return handleTicketInteraction(interaction);

    // ── Botones de cancelar orden ─────────────────────────────────────────
    if (interaction.isButton()) {
        if (interaction.customId.startsWith('cancelar_confirm_')) {
            const ordenId = parseInt(interaction.customId.split('_')[2]);
            const data    = loadData(interaction.guild.id);
            const venta   = data.ventas.find(v => v.id === ordenId);
            if (!venta || venta.estado === 'cancelada')
                return interaction.update({ content: '⚠️ Esta orden ya fue procesada.', components: [] });
            venta.estado = 'cancelada';
            data.analytics.totalVentas = Math.max(0, data.analytics.totalVentas - 1);
            data.analytics.totalRobux  = Math.max(0, data.analytics.totalRobux - venta.robux);
            if (data.analytics.porVendedor[venta.vendedorId]) {
                data.analytics.porVendedor[venta.vendedorId].ventas--;
                data.analytics.porVendedor[venta.vendedorId].robux -= venta.robux;
            }
            if (data.analytics.porCliente?.[venta.clienteId]) {
                data.analytics.porCliente[venta.clienteId].compras--;
                data.analytics.porCliente[venta.clienteId].robux -= venta.robux;
            }
            saveData(interaction.guild.id, data);
            const embed = new EmbedBuilder().setColor('#ED4245')
                .setTitle('❌  Orden cancelada')
                .setDescription(
                    `> 🔖  **Orden:**    \`#${ordenId}\`\n` +
                    `> 📦  **Producto:** \`${venta.producto}\`\n` +
                    `> 👤  **Cliente:**  <@${venta.clienteId}>\n` +
                    `> 🔨  **Por:**      <@${interaction.user.id}>`
                ).setTimestamp();
            return interaction.update({ embeds: [embed], components: [] });
        }
        if (interaction.customId.startsWith('cancelar_abort_'))
            return interaction.update({ content: '✅ Cancelación abortada.', components: [] });

        // Botón reseña
        if (interaction.customId.startsWith('reseña_')) {
            const ordenId = parseInt(interaction.customId.split('_')[1]);
            const data    = loadData(interaction.guild.id);
            const venta   = data.ventas.find(v => v.id === ordenId);
            if (!venta || interaction.user.id !== venta.clienteId)
                return interaction.reply({ content: '⚠️ Solo el cliente de esta orden puede dejar reseña.', ephemeral: true });
            if (data.resenas.find(r => r.ordenId === ordenId))
                return interaction.reply({ content: '⚠️ Ya dejaste una reseña para esta orden.', ephemeral: true });
            const modal = new ModalBuilder().setCustomId(`modal_resena_${ordenId}`).setTitle(`Reseña — Orden #${ordenId}`);
            modal.addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder().setCustomId('estrellas').setLabel('Calificación (1 a 5)').setPlaceholder('Número del 1 al 5').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(1)
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder().setCustomId('comentario').setLabel('Comentario (opcional)').setStyle(TextInputStyle.Paragraph).setRequired(false).setMaxLength(300)
                )
            );
            return interaction.showModal(modal);
        }
    }

    // ── Modales ───────────────────────────────────────────────────────────
    if (interaction.isModalSubmit() && interaction.customId.startsWith('modal_resena_')) {
        const ordenId      = parseInt(interaction.customId.split('_')[2]);
        const data         = loadData(interaction.guild.id);
        const venta        = data.ventas.find(v => v.id === ordenId);
        const numEstrellas = parseInt(interaction.fields.getTextInputValue('estrellas'));
        const comentario   = interaction.fields.getTextInputValue('comentario') || null;
        if (isNaN(numEstrellas) || numEstrellas < 1 || numEstrellas > 5)
            return interaction.reply({ content: '⚠️ La calificación debe ser un número del 1 al 5.', ephemeral: true });
        data.resenas.push({ ordenId, clienteId: venta.clienteId, clienteTag: venta.clienteTag, vendedorId: venta.vendedorId, estrellas: numEstrellas, comentario, timestamp: Date.now() });
        saveData(interaction.guild.id, data);
        const embedResena = new EmbedBuilder().setColor('#FEE75C')
            .setTitle(`${estrellas(numEstrellas)}  Reseña — Orden \`#${ordenId}\``)
            .setDescription(
                `> 👤  **Cliente:**  <@${venta.clienteId}>\n` +
                `> 🤝  **Operador:** <@${venta.vendedorId}>\n` +
                (comentario ? `\n> 💬  *"${comentario}"*` : '')
            ).setTimestamp();
        await interaction.reply({ embeds: [embedResena] });
        if (data.config.resenaChannelId) {
            const canal = interaction.guild.channels.cache.get(data.config.resenaChannelId);
            if (canal) await canal.send({ embeds: [embedResena] });
        }
        return;
    }

    if (!interaction.isChatInputCommand()) return;

    const data  = loadData(interaction.guild.id);
    const guild = interaction.guild;
    const user  = interaction.user;

    if (interaction.commandName === 'help')
        return interaction.reply({ embeds: [buildHelpEmbed()], ephemeral: true });

    if (interaction.commandName === 'ping')
        return interaction.reply(`🏓 Pong! \`${Math.round(client.ws.ping)}ms\``);

    if (interaction.commandName === 'ticket-setup')
        return handleTicketSetup(interaction);

    // /vender
    if (interaction.commandName === 'vender') {
        const espera = checkCooldown(guild.id, user.id, 'vender', 10);
        if (espera > 0) return interaction.reply({ content: `⏳ Espera **${espera}s**.`, ephemeral: true });
        const producto = interaction.options.getString('producto');
        const clienteU = interaction.options.getUser('cliente');
        const vendedor = interaction.options.getUser('vendedor');
        const cantidad = interaction.options.getString('cantidad');
        const precio   = interaction.options.getString('precio');
        const metodo   = interaction.options.getString('metodo') ?? 'No especificado';
        const robux    = parseRobux(cantidad);
        if (!robux) return interaction.reply({ content: '⚠️ Cantidad inválida. Usa: `1000`, `1k`, `2.5k`.', ephemeral: true });
        const numeroOrden = data.ventas.length + 1;
        const venta = { id: numeroOrden, producto, clienteId: clienteU.id, clienteTag: clienteU.tag, vendedorId: vendedor.id, vendedorTag: vendedor.tag, robux, precio: precio ?? 'No especificado', metodo, timestamp: Date.now(), estado: 'completada' };
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
        const rowResena = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`reseña_${numeroOrden}`).setLabel('⭐ Dejar reseña').setStyle(ButtonStyle.Secondary)
        );
        await interaction.reply({ embeds: [buildVentaPublicaEmbed(venta, numeroOrden)], components: [rowResena] });
        if (data.config.dmEnabled) {
            try { await clienteU.send({ embeds: [buildDMEmbed(venta, numeroOrden, guild.name)] }); }
            catch { console.warn(`No se pudo enviar DM a ${clienteU.tag}`); }
        }
        if (data.config.logChannelId) {
            const logChannel = guild.channels.cache.get(data.config.logChannelId);
            if (logChannel) await logChannel.send({ embeds: [buildLogEmbed(venta, numeroOrden)] });
        }
        if (data.analytics.totalVentas % 10 === 0) {
            const embedHito = new EmbedBuilder().setColor('#FEE75C')
                .setTitle('🏆  ¡Nuevo hito alcanzado!')
                .setDescription(`> **${guild.name}** alcanzó **${data.analytics.totalVentas}** pedidos.\n> 💎 Total: \`${formatRobux(data.analytics.totalRobux)}\``);
            await interaction.followUp({ embeds: [embedHito] });
        }
        return;
    }

    // /orden
    if (interaction.commandName === 'orden') {
        const ordenId = interaction.options.getInteger('id');
        const venta   = data.ventas.find(v => v.id === ordenId);
        if (!venta) return interaction.reply({ content: `⚠️ No existe la orden \`#${ordenId}\`.`, ephemeral: true });
        const resena = data.resenas?.find(r => r.ordenId === ordenId);
        const embed  = new EmbedBuilder().setColor(venta.estado === 'cancelada' ? '#ED4245' : '#5865F2')
            .setTitle(`${venta.estado === 'cancelada' ? '❌' : '✅'}  Orden \`#${venta.id}\``)
            .setDescription(
                `> 📦  **Producto:** \`${venta.producto}\`\n` +
                `> 💎  **Cantidad:** \`${formatRobux(venta.robux)}\`\n` +
                `> 💵  **Precio:**   \`${venta.precio}\`\n` +
                `> 💳  **Método:**   \`${venta.metodo}\`\n` +
                `> ━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                `> 👤  **Cliente:**  <@${venta.clienteId}>\n` +
                `> 🤝  **Operador:** <@${venta.vendedorId}>\n\n` +
                `**⭐ Reseña:** ${resena ? `${estrellas(resena.estrellas)}${resena.comentario ? ` *"${resena.comentario}"*` : ''}` : '*Sin reseña aún*'}`
            )
            .setFooter({ text: `Estado: ${venta.estado}` }).setTimestamp(venta.timestamp);
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // /buscar
    if (interaction.commandName === 'buscar') {
        const objetivo = interaction.options.getUser('cliente');
        const ventas   = data.ventas.filter(v => v.clienteId === objetivo.id && v.estado !== 'cancelada');
        if (ventas.length === 0) return interaction.reply({ content: `📭 **${objetivo.username}** no tiene pedidos.`, ephemeral: true });
        const ultimas    = ventas.slice(-8).reverse();
        const lineas     = ultimas.map(v => `> \`#${v.id}\` **${v.producto}** — \`${formatRobux(v.robux)}\` — <t:${Math.floor(v.timestamp / 1000)}:d>`).join('\n');
        const totalRobux = ventas.reduce((s, v) => s + v.robux, 0);
        const resenas    = data.resenas?.filter(r => r.clienteId === objetivo.id) ?? [];
        const promedio   = resenas.length > 0 ? (resenas.reduce((s, r) => s + r.estrellas, 0) / resenas.length).toFixed(1) : null;
        const embed = new EmbedBuilder().setColor('#5865F2')
            .setTitle(`👤  Historial de ${objetivo.username}`)
            .setThumbnail(objetivo.displayAvatarURL({ dynamic: true }))
            .setDescription(
                `> 🛒  **Pedidos:** \`${ventas.length}\`\n` +
                `> 💎  **R$ gastados:** \`${formatRobux(totalRobux)}\`\n` +
                (promedio ? `> ⭐  **Promedio:** \`${promedio}/5\`\n` : '') +
                `\n**Últimos pedidos:**\n${lineas}`
            )
            .setFooter({ text: `Mostrando ${ultimas.length} de ${ventas.length}` }).setTimestamp();
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // /historial
    if (interaction.commandName === 'historial') {
        const rango   = interaction.options.getString('rango') ?? 'todo';
        const filtroU = interaction.options.getUser('usuario');
        let ventas = rango === 'todo' ? data.ventas : ventasPorRango(data.ventas, rango);
        if (filtroU) ventas = ventas.filter(v => v.clienteId === filtroU.id || v.vendedorId === filtroU.id);
        if (ventas.length === 0) return interaction.reply({ content: '📭 No hay pedidos con ese filtro.', ephemeral: true });
        const ultimas = ventas.slice(-10).reverse();
        const lineas  = ultimas.map(v => {
            const t = v.estado === 'cancelada' ? '~~' : '';
            return `> \`#${v.id}\` ${t}**${v.producto}**${t} — \`${formatRobux(v.robux)}\` — <@${v.clienteId}>`;
        }).join('\n');
        const embed = new EmbedBuilder().setColor('#5865F2')
            .setTitle(`📜  Historial — ${guild.name}`)
            .setDescription(
                `${lineas}\n\n` +
                `> 🧾  **Total:** \`${ventas.length}\`\n` +
                `> 💎  **R$ movidos:** \`${formatRobux(ventas.reduce((s, v) => s + v.robux, 0))}\``
            )
            .setFooter({ text: `Últimos ${ultimas.length} de ${ventas.length}` }).setTimestamp();
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // /reseña
    if (interaction.commandName === 'reseña') {
        const ordenId = interaction.options.getInteger('orden');
        const venta   = data.ventas.find(v => v.id === ordenId);
        if (!venta) return interaction.reply({ content: `⚠️ No existe la orden \`#${ordenId}\`.`, ephemeral: true });
        if (venta.clienteId !== user.id) return interaction.reply({ content: '⚠️ Solo el cliente puede dejar reseña.', ephemeral: true });
        if (data.resenas?.find(r => r.ordenId === ordenId)) return interaction.reply({ content: '⚠️ Ya dejaste una reseña para esta orden.', ephemeral: true });
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
        const resenas  = data.resenas?.filter(r => r.vendedorId === objetivo.id) ?? [];
        if (resenas.length === 0) return interaction.reply({ content: `📭 **${objetivo.username}** no tiene reseñas.`, ephemeral: true });
        const promedio = (resenas.reduce((s, r) => s + r.estrellas, 0) / resenas.length).toFixed(1);
        const ultimas  = resenas.slice(-5).reverse();
        const lineas   = ultimas.map(r => `> ${estrellas(r.estrellas)} <@${r.clienteId}>` + (r.comentario ? ` — *"${r.comentario}"*` : '')).join('\n');
        const embed = new EmbedBuilder().setColor('#FEE75C')
            .setTitle(`⭐  Reseñas de ${objetivo.username}`)
            .setThumbnail(objetivo.displayAvatarURL({ dynamic: true }))
            .setDescription(`> **Promedio:** \`${promedio}/5\` *(${resenas.length} reseña${resenas.length !== 1 ? 's' : ''})*\n\n${lineas}`)
            .setFooter({ text: `Últimas ${ultimas.length} de ${resenas.length}` }).setTimestamp();
        return interaction.reply({ embeds: [embed] });
    }

    // /cancelar
    if (interaction.commandName === 'cancelar') {
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages))
            return interaction.reply({ content: '🚫 Necesitas permiso de **Gestionar mensajes**.', ephemeral: true });
        const ordenId = interaction.options.getInteger('orden');
        const venta   = data.ventas.find(v => v.id === ordenId);
        if (!venta) return interaction.reply({ content: `⚠️ No existe la orden \`#${ordenId}\`.`, ephemeral: true });
        if (venta.estado === 'cancelada') return interaction.reply({ content: `⚠️ Ya está cancelada.`, ephemeral: true });
        const embed = new EmbedBuilder().setColor('#ED4245')
            .setTitle(`⚠️  ¿Cancelar orden \`#${ordenId}\`?`)
            .setDescription(
                `> 📦  **Producto:** \`${venta.producto}\`\n` +
                `> 👤  **Cliente:**  <@${venta.clienteId}>\n` +
                `> 💎  **Cantidad:** \`${formatRobux(venta.robux)}\`\n\n` +
                `*Esta acción **no se puede deshacer**.*`
            );
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`cancelar_confirm_${ordenId}`).setLabel('Sí, cancelar').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId(`cancelar_abort_${ordenId}`).setLabel('No, mantener').setStyle(ButtonStyle.Secondary)
        );
        return interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
    }

    // /exportar
    if (interaction.commandName === 'exportar') {
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages))
            return interaction.reply({ content: '🚫 Necesitas permiso de **Gestionar mensajes**.', ephemeral: true });
        const rango  = interaction.options.getString('rango') ?? 'mes';
        const ventas = ventasPorRango(data.ventas, rango).filter(v => v.estado !== 'cancelada');
        if (ventas.length === 0) return interaction.reply({ content: '📭 No hay pedidos en ese período.', ephemeral: true });
        const etiquetas  = { hoy: 'Hoy', semana: 'Esta semana', mes: 'Este mes' };
        const totalRobux = ventas.reduce((s, v) => s + v.robux, 0);
        let texto = `REPORTE — ${etiquetas[rango] ?? rango}\nServidor: ${guild.name}\nGenerado: ${new Date().toLocaleString('es-MX')}\n${'─'.repeat(60)}\n\n`;
        ventas.forEach(v => { texto += `#${v.id} | ${v.producto} | ${formatRobux(v.robux)} | ${v.precio} | ${v.metodo} | Cliente: ${v.clienteTag} | Operador: ${v.vendedorTag}\n`; });
        texto += `\n${'─'.repeat(60)}\nTOTAL: ${ventas.length} pedidos | ${formatRobux(totalRobux)}\n`;
        return interaction.reply({ content: `📁 **${ventas.length}** pedidos exportados:`, files: [{ attachment: Buffer.from(texto, 'utf8'), name: `pedidos-${rango}.txt` }], ephemeral: true });
    }

    // /perfil
    if (interaction.commandName === 'perfil') {
        const objetivo     = interaction.options.getUser('usuario');
        const comoVendedor = data.ventas.filter(v => v.vendedorId === objetivo.id && v.estado !== 'cancelada');
        const comoCliente  = data.ventas.filter(v => v.clienteId  === objetivo.id && v.estado !== 'cancelada');
        const resenas      = data.resenas?.filter(r => r.vendedorId === objetivo.id) ?? [];
        const promedio     = resenas.length > 0 ? `${(resenas.reduce((s, r) => s + r.estrellas, 0) / resenas.length).toFixed(1)}/5` : 'Sin reseñas';
        const embed = new EmbedBuilder().setColor('#5865F2')
            .setTitle(`👤  ${objetivo.username}`)
            .setThumbnail(objetivo.displayAvatarURL({ dynamic: true }))
            .setDescription(
                `**Como operador**\n` +
                `> 🧾  **Pedidos:**    \`${comoVendedor.length}\`\n` +
                `> 💎  **R$ movidos:** \`${formatRobux(comoVendedor.reduce((s, v) => s + v.robux, 0))}\`\n` +
                `> ⭐  **Valoración:** \`${promedio}\`\n\n` +
                `**Como cliente**\n` +
                `> 🛒  **Compras:**    \`${comoCliente.length}\`\n` +
                `> 💎  **R$ gastados:** \`${formatRobux(comoCliente.reduce((s, v) => s + v.robux, 0))}\``
            )
            .setFooter({ text: guild.name }).setTimestamp();
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // /stats
    if (interaction.commandName === 'stats') {
        const rango  = interaction.options.getString('rango') ?? 'hoy';
        const ventas = ventasPorRango(data.ventas, rango).filter(v => v.estado !== 'cancelada');
        const robux  = ventas.reduce((s, v) => s + v.robux, 0);
        const etiquetas = { hoy: 'Hoy', semana: 'Esta semana', mes: 'Este mes' };
        const embed = new EmbedBuilder().setColor('#FEE75C')
            .setTitle(`📊  Stats — ${etiquetas[rango] ?? rango}`)
            .setDescription(
                `> 🧾  **Pedidos:**         \`${ventas.length}\`\n` +
                `> 💎  **R$ movidos:**      \`${formatRobux(robux)}\`\n` +
                `> 👥  **Clientes únicos:** \`${new Set(ventas.map(v => v.clienteId)).size}\`\n\n` +
                `> 📦  **Total histórico:** \`${data.ventas.filter(v => v.estado !== 'cancelada').length}\`\n` +
                `> 💰  **Total R$ hist.:**  \`${formatRobux(data.analytics.totalRobux)}\``
            )
            .setFooter({ text: guild.name }).setTimestamp();
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // /top
    if (interaction.commandName === 'top') {
        const tipo     = interaction.options.getString('tipo') ?? 'vendedores';
        const por      = interaction.options.getString('por')  ?? 'ventas';
        const medallas = ['🥇', '🥈', '🥉'];
        if (tipo === 'compradores') {
            const compradores = Object.entries(data.analytics.porCliente ?? {}).map(([id, d]) => ({ id, ...d })).filter(c => c.compras > 0).sort((a, b) => por === 'robux' ? b.robux - a.robux : b.compras - a.compras).slice(0, 10);
            if (compradores.length === 0) return interaction.reply({ content: '📭 Sin compras aún.', ephemeral: true });
            const lineas = compradores.map((c, i) => `> ${medallas[i] ?? `**${i + 1}.**`} <@${c.id}> — \`${c.compras}\` compra(s) • \`${formatRobux(c.robux)}\``).join('\n');
            return interaction.reply({ embeds: [new EmbedBuilder().setColor('#FEE75C').setTitle('👑  Top compradores').setDescription(lineas).setTimestamp()] });
        }
        const vendedores = Object.entries(data.analytics.porVendedor).map(([id, d]) => ({ id, ...d })).filter(v => v.ventas > 0).sort((a, b) => por === 'robux' ? b.robux - a.robux : b.ventas - a.ventas).slice(0, 10);
        if (vendedores.length === 0) return interaction.reply({ content: '📭 Sin pedidos aún.', ephemeral: true });
        const lineas = vendedores.map((v, i) => `> ${medallas[i] ?? `**${i + 1}.**`} <@${v.id}> — \`${v.ventas}\` pedido(s) • \`${formatRobux(v.robux)}\``).join('\n');
        return interaction.reply({ embeds: [new EmbedBuilder().setColor('#57F287').setTitle('🏆  Top operadores').setDescription(lineas).setTimestamp()] });
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
        const embed  = new EmbedBuilder().setColor('#5865F2')
            .setTitle(`📈  Dashboard — ${guild.name}`)
            .setThumbnail(guild.iconURL({ dynamic: true }) ?? null)
            .setDescription(
                `> 🌅  **Hoy:**         \`${hoy.length}\` pedidos • \`${formatRobux(hoy.reduce((s, v) => s + v.robux, 0))}\`\n` +
                `> 📅  **Esta semana:** \`${semana.length}\` pedidos • \`${formatRobux(semana.reduce((s, v) => s + v.robux, 0))}\`\n` +
                `> 🗓️  **Este mes:**    \`${mes.length}\` pedidos • \`${formatRobux(mes.reduce((s, v) => s + v.robux, 0))}\`\n` +
                `> 📦  **Histórico:**   \`${data.analytics.totalVentas}\` pedidos • \`${formatRobux(data.analytics.totalRobux)}\`\n\n` +
                `> 🏆  **Top operador:** ${topV ? `<@${topV[0]}> (\`${topV[1].ventas}\` pedidos)` : '`Sin datos`'}\n` +
                `> 👑  **Top cliente:**  ${topC ? `<@${topC[0]}> (\`${topC[1].compras}\` compras)` : '`Sin datos`'}\n` +
                (prom ? `> ⭐  **Valoración:**  \`${prom}/5\` *(${totalR} reseñas)*` : '')
            )
            .setFooter({ text: 'Aurex' }).setTimestamp();
        return interaction.reply({ embeds: [embed] });
    }

    // /afk
    if (interaction.commandName === 'afk') {
        const motivo = interaction.options.getString('motivo') ?? 'Sin motivo';
        data.afk[user.id] = { motivo, tiempo: Date.now(), menciones: [] };
        saveData(guild.id, data);
        return interaction.reply({ embeds: [new EmbedBuilder().setColor('#3498DB').setDescription(`### 💤  AFK activado\n\n> **${user.username}** — *${motivo}*`)] });
    }

    // /anuncio
    if (interaction.commandName === 'anuncio') {
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages))
            return interaction.reply({ content: '🚫 Necesitas permiso de **Gestionar mensajes**.', ephemeral: true });
        const titulo      = interaction.options.getString('titulo');
        const cuerpo      = interaction.options.getString('mensaje');
        const textoBoton  = interaction.options.getString('texto_boton');
        const enlaceBoton = interaction.options.getString('enlace_boton');
        const embed = new EmbedBuilder().setColor('#ED4245').setTitle(`📢  ${titulo}`).setDescription(cuerpo).setFooter({ text: `Anuncio por ${user.tag} · Aurex` }).setTimestamp();
        const opts = { embeds: [embed] };
        if (textoBoton && enlaceBoton) opts.components = [new ActionRowBuilder().addComponents(new ButtonBuilder().setLabel(textoBoton).setURL(enlaceBoton).setStyle(ButtonStyle.Link))];
        await interaction.reply({ content: '✅ Anuncio enviado.', ephemeral: true });
        return interaction.channel.send(opts);
    }

    // /clear
    if (interaction.commandName === 'clear') {
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages))
            return interaction.reply({ content: '🚫 Necesitas permiso de **Gestionar mensajes**.', ephemeral: true });
        const cantidad = interaction.options.getInteger('cantidad');
        if (cantidad < 1 || cantidad > 100) return interaction.reply({ content: '⚠️ Entre 1 y 100.', ephemeral: true });
        const deleted = await interaction.channel.bulkDelete(cantidad, true).catch(() => null);
        return interaction.reply({ content: `🗑️ **${deleted?.size ?? 0}** mensaje(s) eliminados.`, ephemeral: true });
    }

    // /setlog
    if (interaction.commandName === 'setlog') {
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator))
            return interaction.reply({ content: '🚫 Solo administradores.', ephemeral: true });
        data.config.logChannelId = interaction.options.getChannel('canal').id;
        saveData(guild.id, data);
        return interaction.reply({ content: `✅ Canal de logs: <#${data.config.logChannelId}>`, ephemeral: true });
    }

    // /setresenas
    if (interaction.commandName === 'setresenas') {
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator))
            return interaction.reply({ content: '🚫 Solo administradores.', ephemeral: true });
        data.config.resenaChannelId = interaction.options.getChannel('canal').id;
        saveData(guild.id, data);
        return interaction.reply({ content: `✅ Canal de reseñas: <#${data.config.resenaChannelId}>`, ephemeral: true });
    }

    // /configdm
    if (interaction.commandName === 'configdm') {
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator))
            return interaction.reply({ content: '🚫 Solo administradores.', ephemeral: true });
        data.config.dmEnabled = interaction.options.getBoolean('estado');
        saveData(guild.id, data);
        return interaction.reply({ content: `✅ DMs: **${data.config.dmEnabled ? 'activados ✅' : 'desactivados ❌'}**`, ephemeral: true });
    }

    // /setdm
    if (interaction.commandName === 'setdm') {
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator))
            return interaction.reply({ content: '🚫 Solo administradores.', ephemeral: true });
        const texto = interaction.options.getString('texto');
        data.config.dmCierreTexto = texto;
        saveData(guild.id, data);
        return interaction.reply({ embeds: [new EmbedBuilder().setColor('#57F287').setTitle('✅  Mensaje de cierre actualizado').setDescription(`> ${texto.replace(/\n/g, '\n> ')}\n\n*Variables: \`{usuario}\` \`{servidor}\`*`)], ephemeral: true });
    }

    // /stock
    if (interaction.commandName === 'stock') {
        const stock = data.stock ?? [];
        if (stock.length === 0) return interaction.reply({ content: '📭 El stock está vacío.', ephemeral: false });
        const lineas = stock.map(item =>
            `> 📦  **${item.nombre}**\n` +
            `> ├ 🔢 Cantidad: \`${item.cantidad}\`\n` +
            `> ├ 💵 Precio:   \`${item.precio ?? 'No especificado'}\`\n` +
            `> └ 📝 Notas:    \`${item.notas ?? '—'}\``
        ).join('\n\n');
        const embed = new EmbedBuilder().setColor('#5865F2').setTitle('📦  Stock disponible').setDescription(lineas).setFooter({ text: `${stock.length} ítem(s) • ${guild.name} · Aurex` }).setTimestamp();
        return interaction.reply({ embeds: [embed] });
    }

    // /stock-admin
    if (interaction.commandName === 'stock-admin') {
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator))
            return interaction.reply({ content: '🚫 Solo administradores.', ephemeral: true });
        const accion   = interaction.options.getString('accion');
        const nombre   = interaction.options.getString('nombre');
        const cantidad = interaction.options.getInteger('cantidad');
        const precio   = interaction.options.getString('precio');
        const notas    = interaction.options.getString('notas');
        if (!data.stock) data.stock = [];
        if (accion === 'agregar') {
            data.stock.push({ nombre, cantidad: cantidad ?? 0, precio: precio ?? null, notas: notas ?? null });
            saveData(guild.id, data);
            return interaction.reply({ embeds: [new EmbedBuilder().setColor('#57F287').setTitle('✅  Ítem agregado').setDescription(`> 📦  **${nombre}** — Cantidad: \`${cantidad ?? 0}\` — Precio: \`${precio ?? 'No especificado'}\``)], ephemeral: true });
        }
        if (accion === 'editar') {
            const idx = data.stock.findIndex(i => i.nombre.toLowerCase() === nombre?.toLowerCase());
            if (idx === -1) return interaction.reply({ content: `⚠️ No existe \`${nombre}\`.`, ephemeral: true });
            if (cantidad !== null) data.stock[idx].cantidad = cantidad;
            if (precio   !== null) data.stock[idx].precio   = precio;
            if (notas    !== null) data.stock[idx].notas    = notas;
            saveData(guild.id, data);
            return interaction.reply({ content: `✅ \`${data.stock[idx].nombre}\` actualizado.`, ephemeral: true });
        }
        if (accion === 'eliminar') {
            const idx = data.stock.findIndex(i => i.nombre.toLowerCase() === nombre?.toLowerCase());
            if (idx === -1) return interaction.reply({ content: `⚠️ No existe \`${nombre}\`.`, ephemeral: true });
            data.stock.splice(idx, 1);
            saveData(guild.id, data);
            return interaction.reply({ content: `🗑️ **${nombre}** eliminado del stock.`, ephemeral: true });
        }
        if (accion === 'limpiar') {
            data.stock = [];
            saveData(guild.id, data);
            return interaction.reply({ content: '🗑️ Stock limpiado.', ephemeral: true });
        }
    }
});

client.login(process.env.TOKEN);