const { REST, Routes, ApplicationCommandOptionType, ChannelType } = require('discord.js');
require('dotenv').config();

const commands = [

    // ── General ───────────────────────────────────────────────────────────
    { name: 'ping',      description: 'Muestra la latencia del bot.' },
    { name: 'help',      description: 'Muestra todos los comandos disponibles.' },
    { name: 'dashboard', description: 'Resumen visual completo de pedidos y clientes.' },

    // ── Pedidos ───────────────────────────────────────────────────────────
    {
        name: 'vender',
        description: 'Registra un nuevo pedido.',
        options: [
            { name: 'producto', type: ApplicationCommandOptionType.String,  description: 'Producto o servicio vendido',             required: true  },
            { name: 'cliente',  type: ApplicationCommandOptionType.User,    description: 'Usuario que realizó el pedido',           required: true  },
            { name: 'vendedor', type: ApplicationCommandOptionType.User,    description: 'Operador que atendió el pedido',          required: true  },
            { name: 'monto',    type: ApplicationCommandOptionType.String,  description: 'Cantidad del producto (ej: 1000, 1k)',    required: false },
            { name: 'precio',   type: ApplicationCommandOptionType.String,  description: 'Precio cobrado (ej: $5 USD, 130 MXN)',   required: false },
            { name: 'metodo',   type: ApplicationCommandOptionType.String,  description: 'Método de pago (PayPal, Binance, etc.)', required: false },
            { name: 'notas',    type: ApplicationCommandOptionType.String,  description: 'Notas adicionales del pedido',           required: false }
        ]
    },
    {
        name: 'historial',
        description: 'Muestra el historial de pedidos del servidor.',
        options: [
            {
                name: 'rango', type: ApplicationCommandOptionType.String, description: 'Período de tiempo', required: false,
                choices: [
                    { name: 'Hoy',         value: 'hoy'    },
                    { name: 'Esta semana', value: 'semana' },
                    { name: 'Este mes',    value: 'mes'    },
                    { name: 'Todo',        value: 'todo'   }
                ]
            },
            { name: 'usuario', type: ApplicationCommandOptionType.User, description: 'Filtrar por cliente u operador', required: false }
        ]
    },
    {
        name: 'orden',
        description: 'Muestra los detalles de un pedido específico.',
        options: [
            { name: 'id', type: ApplicationCommandOptionType.Integer, description: 'Número de orden', required: true }
        ]
    },
    {
        name: 'buscar',
        description: 'Busca todos los pedidos realizados por un cliente.',
        options: [
            { name: 'cliente', type: ApplicationCommandOptionType.User, description: 'Cliente a buscar', required: true }
        ]
    },
    {
        name: 'cancelar',
        description: 'Cancela un pedido (pide confirmación).',
        options: [
            { name: 'orden', type: ApplicationCommandOptionType.Integer, description: 'Número de orden a cancelar', required: true }
        ]
    },
    {
        name: 'exportar',
        description: 'Exporta los pedidos de un período como archivo .txt.',
        options: [
            {
                name: 'rango', type: ApplicationCommandOptionType.String, description: 'Período a exportar', required: false,
                choices: [
                    { name: 'Hoy',         value: 'hoy'    },
                    { name: 'Esta semana', value: 'semana' },
                    { name: 'Este mes',    value: 'mes'    }
                ]
            }
        ]
    },
    {
        name: 'factura',
        description: 'Envía un comprobante detallado de una orden por DM al cliente.',
        options: [
            { name: 'orden', type: ApplicationCommandOptionType.Integer, description: 'Número de orden', required: true }
        ]
    },

    // ── Analíticas ────────────────────────────────────────────────────────
    {
        name: 'stats',
        description: 'Estadísticas de pedidos por período.',
        options: [
            {
                name: 'rango', type: ApplicationCommandOptionType.String, description: 'Período', required: false,
                choices: [
                    { name: 'Hoy',         value: 'hoy'    },
                    { name: 'Esta semana', value: 'semana' },
                    { name: 'Este mes',    value: 'mes'    }
                ]
            }
        ]
    },
    {
        name: 'top',
        description: 'Ranking de operadores o clientes del servidor.',
        options: [
            {
                name: 'tipo', type: ApplicationCommandOptionType.String, description: '¿Qué ranking mostrar?', required: false,
                choices: [
                    { name: 'Operadores', value: 'vendedores'  },
                    { name: 'Clientes',   value: 'compradores' }
                ]
            }
        ]
    },
    {
        name: 'perfil',
        description: 'Ver estadísticas de un operador o cliente.',
        options: [
            { name: 'usuario', type: ApplicationCommandOptionType.User, description: 'Usuario a consultar', required: true }
        ]
    },
    {
        name: 'servidor-stats',
        description: 'Tarjeta completa con clientes únicos, operadores, tickets cerrados y totales.'
    },

    // ── Reputación ────────────────────────────────────────────────────────
    {
        name: 'reseña',
        description: 'Deja una valoración para un pedido que realizaste.',
        options: [
            { name: 'orden', type: ApplicationCommandOptionType.Integer, description: 'Número de orden a valorar', required: true }
        ]
    },
    {
        name: 'resenas',
        description: 'Ver las valoraciones recibidas por un operador.',
        options: [
            { name: 'vendedor', type: ApplicationCommandOptionType.User, description: 'Operador a consultar', required: true }
        ]
    },

    // ── Tickets ───────────────────────────────────────────────────────────
    {
        name: 'ticket-setup',
        description: 'Configura y envía el panel de tickets (solo admins).',
        options: [
            {
                name: 'canal', type: ApplicationCommandOptionType.Channel,
                description: 'Canal donde se enviará el panel', required: true,
                channel_types: [ChannelType.GuildText]
            },
            {
                name: 'categoria', type: ApplicationCommandOptionType.Channel,
                description: 'Categoría de Discord donde se crearán los canales de ticket', required: false,
                channel_types: [ChannelType.GuildCategory]
            },
            {
                name: 'logs', type: ApplicationCommandOptionType.Channel,
                description: 'Canal donde se guardan los transcripts y logs', required: false,
                channel_types: [ChannelType.GuildText]
            },
            {
                name: 'rol_vendedor', type: ApplicationCommandOptionType.Role,
                description: 'Rol que se notifica en tickets de compra', required: false
            },
            {
                name: 'rol_staff', type: ApplicationCommandOptionType.Role,
                description: 'Rol de staff que puede ver y gestionar tickets', required: false
            },
            {
                name: 'imagen', type: ApplicationCommandOptionType.String,
                description: 'URL de imagen para el banner del panel (https://...)', required: false
            }
        ]
    },

    // ── Club VIP ──────────────────────────────────────────────────────────
    {
        name: 'vip-setup',
        description: 'Configura el rol que se asignará con /clubvip (solo admins).',
        options: [
            {
                name: 'rol', type: ApplicationCommandOptionType.Role,
                description: 'Rol VIP que se asignará y quitará automáticamente al expirar',
                required: true
            }
        ]
    },
    {
        name: 'clubvip',
        description: 'Asigna membresía VIP a un usuario con duración definida.',
        options: [
            { name: 'cliente',  type: ApplicationCommandOptionType.User,   description: 'Usuario al que se le asigna el VIP',  required: true },
            { name: 'duracion', type: ApplicationCommandOptionType.String, description: 'Duración (ej: 7d, 30d, 2h). Max 365d', required: true }
        ]
    },

    // ── Utilidades ────────────────────────────────────────────────────────
    {
        name: 'afk',
        description: 'Activa el modo AFK y registra las menciones que recibas.',
        options: [
            { name: 'motivo', type: ApplicationCommandOptionType.String, description: 'Motivo de ausencia (opcional)', required: false }
        ]
    },
    {
        name: 'anuncio',
        description: 'Envía un anuncio con embed al canal actual.',
        options: [
            { name: 'titulo',       type: ApplicationCommandOptionType.String, description: 'Título del anuncio',                       required: true  },
            { name: 'mensaje',      type: ApplicationCommandOptionType.String, description: 'Cuerpo del anuncio',                       required: true  },
            { name: 'imagen',       type: ApplicationCommandOptionType.String, description: 'URL de imagen (https://...)',              required: false },
            { name: 'texto_boton',  type: ApplicationCommandOptionType.String, description: 'Texto del botón de enlace (opcional)',     required: false },
            { name: 'enlace_boton', type: ApplicationCommandOptionType.String, description: 'URL del botón (https://...)',              required: false }
        ]
    },
    {
        name: 'sorteo',
        description: 'Crea un sorteo con roles opcionales de bonus (solo admins).',
        options: [
            { name: 'premio',     type: ApplicationCommandOptionType.String,  description: 'Premio del sorteo',                        required: true  },
            { name: 'duracion',   type: ApplicationCommandOptionType.String,  description: 'Duración (ej: 30s, 10m, 2h, 1d)',          required: true  },
            { name: 'ganadores',  type: ApplicationCommandOptionType.Integer, description: 'Cantidad de ganadores (por defecto 1)',     required: false },
            { name: 'imagen',     type: ApplicationCommandOptionType.String,  description: 'URL de imagen personalizada (https://...)', required: false },
            // Rol 1
            { name: 'rol_1',      type: ApplicationCommandOptionType.Role,    description: 'Rol con bonus de participaciones',         required: false },
            { name: 'entradas_1', type: ApplicationCommandOptionType.Integer, description: 'Participaciones para rol_1 (ej: 3)',        required: false },
            // Rol 2
            { name: 'rol_2',      type: ApplicationCommandOptionType.Role,    description: 'Segundo rol con bonus',                    required: false },
            { name: 'entradas_2', type: ApplicationCommandOptionType.Integer, description: 'Participaciones para rol_2',               required: false },
            // Rol 3
            { name: 'rol_3',      type: ApplicationCommandOptionType.Role,    description: 'Tercer rol con bonus',                     required: false },
            { name: 'entradas_3', type: ApplicationCommandOptionType.Integer, description: 'Participaciones para rol_3',               required: false },
            // Rol 4
            { name: 'rol_4',      type: ApplicationCommandOptionType.Role,    description: 'Cuarto rol con bonus',                     required: false },
            { name: 'entradas_4', type: ApplicationCommandOptionType.Integer, description: 'Participaciones para rol_4',               required: false }
        ]
    },
    {
        name: 'notificar',
        description: 'Envía un DM masivo a todos los clientes registrados (solo admins).',
        options: [
            { name: 'mensaje',      type: ApplicationCommandOptionType.String,  description: 'Cuerpo del mensaje',                         required: true  },
            { name: 'titulo',       type: ApplicationCommandOptionType.String,  description: 'Título del embed (opcional)',                 required: false },
            { name: 'imagen',       type: ApplicationCommandOptionType.String,  description: 'URL de imagen (https://...)',                 required: false },
            { name: 'solo_activos', type: ApplicationCommandOptionType.Boolean, description: 'Solo clientes activos en los últimos 30 días', required: false }
        ]
    },
    {
        name: 'clear',
        description: 'Borra mensajes del canal (máx 100).',
        options: [
            { name: 'cantidad', type: ApplicationCommandOptionType.Integer, description: 'Mensajes a borrar (1-100)', required: true }
        ]
    },

    // ── Configuración ─────────────────────────────────────────────────────
    {
        name: 'setlog',
        description: 'Define el canal de logs de pedidos (solo admins).',
        options: [
            {
                name: 'canal', type: ApplicationCommandOptionType.Channel,
                description: 'Canal de texto para logs de pedidos', required: true,
                channel_types: [ChannelType.GuildText]
            }
        ]
    },
    {
        name: 'setresenas',
        description: 'Define el canal donde se publican las reseñas (solo admins).',
        options: [
            {
                name: 'canal', type: ApplicationCommandOptionType.Channel,
                description: 'Canal de texto para reseñas', required: true,
                channel_types: [ChannelType.GuildText]
            }
        ]
    },
    {
        name: 'configdm',
        description: 'Activa o desactiva los DMs automáticos al comprador (solo admins).',
        options: [
            { name: 'estado', type: ApplicationCommandOptionType.Boolean, description: 'true = activar | false = desactivar', required: true }
        ]
    },
    {
        name: 'setdm',
        description: 'Personaliza el mensaje de cierre de ticket enviado por DM (solo admins).',
        options: [
            {
                name: 'texto', type: ApplicationCommandOptionType.String,
                description: 'Mensaje. Variables disponibles: {usuario} {servidor}',
                required: true
            }
        ]
    },
    {
        name: 'settiers',
        description: 'Configura roles automáticos por número de compras (solo admins).',
        options: [
            { name: 'bronce',        type: ApplicationCommandOptionType.Role,    description: 'Rol para Bronce',                        required: false },
            { name: 'plata',         type: ApplicationCommandOptionType.Role,    description: 'Rol para Plata',                         required: false },
            { name: 'oro',           type: ApplicationCommandOptionType.Role,    description: 'Rol para Oro',                           required: false },
            { name: 'vip',           type: ApplicationCommandOptionType.Role,    description: 'Rol para VIP',                           required: false },
            { name: 'umbral_bronce', type: ApplicationCommandOptionType.Integer, description: 'Compras mínimas para Bronce (def: 1)',   required: false },
            { name: 'umbral_plata',  type: ApplicationCommandOptionType.Integer, description: 'Compras mínimas para Plata (def: 5)',    required: false },
            { name: 'umbral_oro',    type: ApplicationCommandOptionType.Integer, description: 'Compras mínimas para Oro (def: 10)',     required: false },
            { name: 'umbral_vip',    type: ApplicationCommandOptionType.Integer, description: 'Compras mínimas para VIP (def: 20)',     required: false }
        ]
    },
    {
        name: 'setvip',
        description: 'Define el rol VIP para bonus en sorteos (solo admins).',
        options: [
            {
                name: 'rol', type: ApplicationCommandOptionType.Role,
                description: 'Rol que otorga participaciones extra en sorteos',
                required: true
            }
        ]
    }
];

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

(async () => {
    try {
        console.log(`🔄 Registrando ${commands.length} comandos globales...`);
        await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
        console.log(`✅ ${commands.length} comandos registrados correctamente.`);
    } catch (error) {
        console.error('❌ Error al registrar comandos:', error);
    }
})();