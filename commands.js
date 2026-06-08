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
            { name: 'producto', type: ApplicationCommandOptionType.String,  description: 'Producto o servicio',                     required: true  },
            { name: 'cliente',  type: ApplicationCommandOptionType.User,    description: 'Usuario que realizó el pedido',           required: true  },
            { name: 'vendedor', type: ApplicationCommandOptionType.User,    description: 'Operador que atendió el pedido',          required: true  },
            { name: 'cantidad', type: ApplicationCommandOptionType.String,  description: 'Cantidad (ej: 1000, 1k, 2.5k)',          required: true  },
            { name: 'precio',   type: ApplicationCommandOptionType.String,  description: 'Precio cobrado (ej: $5 USD, 130 MXN)',   required: false },
            { name: 'metodo',   type: ApplicationCommandOptionType.String,  description: 'Método de pago (PayPal, Binance, etc.)', required: false }
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
            { name: 'usuario', type: ApplicationCommandOptionType.User, description: 'Filtrar por cliente o operador', required: false }
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

    // ── Stock ─────────────────────────────────────────────────────────────
    { name: 'stock', description: 'Muestra el stock disponible del servidor.' },
    {
        name: 'stock-admin',
        description: 'Gestiona el stock del servidor (solo admins).',
        options: [
            {
                name: 'accion', type: ApplicationCommandOptionType.String, description: 'Acción a realizar', required: true,
                choices: [
                    { name: 'Agregar ítem',         value: 'agregar'  },
                    { name: 'Editar ítem',           value: 'editar'   },
                    { name: 'Eliminar ítem',         value: 'eliminar' },
                    { name: 'Limpiar todo el stock', value: 'limpiar'  }
                ]
            },
            { name: 'nombre',   type: ApplicationCommandOptionType.String,  description: 'Nombre del ítem',            required: false },
            { name: 'cantidad', type: ApplicationCommandOptionType.Integer, description: 'Cantidad disponible',         required: false },
            { name: 'precio',   type: ApplicationCommandOptionType.String,  description: 'Precio del ítem',            required: false },
            { name: 'notas',    type: ApplicationCommandOptionType.String,  description: 'Notas adicionales del ítem', required: false }
        ]
    },
    {
        name: 'stock-bulk',
        description: 'Agrega o reemplaza varios ítems de stock de golpe (solo admins).',
        options: [
            {
                name: 'items', type: ApplicationCommandOptionType.String, required: true,
                description: 'Un ítem por línea: Nombre | cantidad | precio | notas'
            },
            {
                name: 'modo', type: ApplicationCommandOptionType.String, required: false,
                description: '¿Agregar al stock actual o reemplazarlo todo?',
                choices: [
                    { name: 'Agregar al stock actual',  value: 'agregar'    },
                    { name: 'Reemplazar todo el stock', value: 'reemplazar' }
                ]
            }
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
            },
            {
                name: 'por', type: ApplicationCommandOptionType.String, description: 'Ordenar por', required: false,
                choices: [
                    { name: 'Número de pedidos/compras', value: 'ventas' },
                    { name: 'Cantidad movida en R$',     value: 'robux'  }
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
        description: 'Tarjeta completa con clientes únicos, operadores, tickets cerrados y R$ totales.'
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
                description: 'Categoría donde se crearán los canales de ticket', required: false,
                channel_types: [ChannelType.GuildCategory]
            },
            {
                name: 'logs', type: ApplicationCommandOptionType.Channel,
                description: 'Canal donde se guardan los transcripts', required: false,
                channel_types: [ChannelType.GuildText]
            },
            {
                name: 'rol_vendedor', type: ApplicationCommandOptionType.Role,
                description: 'Rol que se notifica en tickets de compra', required: false
            },
            {
                name: 'rol_staff', type: ApplicationCommandOptionType.Role,
                description: 'Rol de staff que puede ver y cerrar tickets', required: false
            }
        ]
    },

    // ── Utilidades ────────────────────────────────────────────────────────
    {
        name: 'afk',
        description: 'Activa el modo AFK y registra las menciones que recibas.',
        options: [
            { name: 'motivo', type: ApplicationCommandOptionType.String, description: 'Motivo de ausencia', required: false }
        ]
    },
    {
        name: 'anuncio',
        description: 'Envía un anuncio con embed al canal actual.',
        options: [
            { name: 'titulo',       type: ApplicationCommandOptionType.String, description: 'Título del anuncio',                required: true  },
            { name: 'mensaje',      type: ApplicationCommandOptionType.String, description: 'Cuerpo del anuncio',                required: true  },
            { name: 'imagen',       type: ApplicationCommandOptionType.String, description: 'URL de imagen para el anuncio (https://...)', required: false },
            { name: 'texto_boton',  type: ApplicationCommandOptionType.String, description: 'Texto del botón (opcional)',        required: false },
            { name: 'enlace_boton', type: ApplicationCommandOptionType.String, description: 'URL del botón (https://...)',       required: false }
        ]
    },
    {
        name: 'sorteo',
        description: 'Crea un sorteo. VIPs tienen doble entrada. (Solo admins)',
        options: [
            { name: 'premio',    type: ApplicationCommandOptionType.String,  description: 'Premio del sorteo',                   required: true  },
            { name: 'duracion',  type: ApplicationCommandOptionType.Integer, description: 'Duración en minutos (por defecto 60)', required: false },
            { name: 'ganadores', type: ApplicationCommandOptionType.Integer, description: 'Cantidad de ganadores (por defecto 1)',required: false },
            { name: 'imagen',    type: ApplicationCommandOptionType.String,  description: 'URL de imagen personalizada (https://...)', required: false }
        ]
    },
    {
        name: 'notificar',
        description: 'Envía un DM masivo a todos los clientes registrados. (Solo admins)',
        options: [
            { name: 'mensaje',      type: ApplicationCommandOptionType.String,  description: 'Cuerpo del mensaje',                          required: true  },
            { name: 'titulo',       type: ApplicationCommandOptionType.String,  description: 'Título del embed (opcional)',                  required: false },
            { name: 'imagen',       type: ApplicationCommandOptionType.String,  description: 'URL de imagen para el DM (https://...)',       required: false },
            { name: 'solo_activos', type: ApplicationCommandOptionType.Boolean, description: 'Solo clientes activos en los últimos 30 días', required: false }
        ]
    },
    {
        name: 'clear',
        description: 'Borra mensajes del canal.',
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
                description: 'Canal de texto para logs', required: true,
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
        description: 'Activa o desactiva los DMs al comprador (solo admins).',
        options: [
            { name: 'estado', type: ApplicationCommandOptionType.Boolean, description: 'true = activar | false = desactivar', required: true }
        ]
    },
    {
        name: 'setdm',
        description: 'Personaliza el mensaje al cerrar un ticket (solo admins).',
        options: [
            {
                name: 'texto', type: ApplicationCommandOptionType.String,
                description: 'Mensaje personalizado. Variables: {usuario} {servidor}',
                required: true
            }
        ]
    },
    {
        name: 'settiers',
        description: 'Configura los roles que se asignan por tier de compras (solo admins).',
        options: [
            { name: 'bronce', type: ApplicationCommandOptionType.Role, description: 'Rol para Bronce (1+ compra)',   required: false },
            { name: 'plata',  type: ApplicationCommandOptionType.Role, description: 'Rol para Plata (5+ compras)',  required: false },
            { name: 'oro',    type: ApplicationCommandOptionType.Role, description: 'Rol para Oro (10+ compras)',   required: false },
            { name: 'vip',    type: ApplicationCommandOptionType.Role, description: 'Rol para VIP (20+ compras)',   required: false }
        ]
    },
    {
        name: 'setvip',
        description: 'Define el rol VIP para doble entrada en sorteos (solo admins).',
        options: [
            {
                name: 'rol', type: ApplicationCommandOptionType.Role,
                description: 'Rol que otorga doble entrada en sorteos',
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