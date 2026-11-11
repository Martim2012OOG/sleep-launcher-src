/* Idiomas do launcher (inglês, português, espanhol).
   Os textos da interface estão escritos em português (é a língua "de origem"); este ficheiro traduz-os ao desenhar o ecrã.
   REGRA: sempre que se acrescenta um texto novo ao launcher, acrescenta-se aqui uma linha  "português|english|español".
   Textos com números (ex.: "Faltam 50") usam as regras de PADRÕES mais abaixo. Para um idioma novo: nova coluna + entrada em LANGS. */
(function(){
const LANGS=[["en","English","🇬🇧"],["pt","Português (Portugal)","🇵🇹"],["es","Español","🇪🇸"]];
const TABLE=`[Sleep] Ainda a carregar. Com muitos mods, o Minecraft pode demorar 1 ou 2 minutos a escrever a primeira linha aqui, sobretudo com antivírus.|[Sleep] Still loading. With many mods, Minecraft can take 1 or 2 minutes to write its first line here, especially with an antivirus.|[Sleep] Todavía cargando. Con muchos mods, Minecraft puede tardar 1 o 2 minutos en escribir la primera línea aquí, sobre todo con antivirus.
[Sleep] Isto está a demorar demasiado. Vê se apareceu uma janela de erro ou se o antivírus bloqueou o Java. Se continuar, carrega em Parar o jogo e manda o que estiver no separador Logs.|[Sleep] This is taking too long. Check whether an error window appeared or an antivirus blocked Java. If it continues, press Stop the game and send what is in the Logs tab.|[Sleep] Esto está tardando demasiado. Mira si apareció una ventana de error o si el antivirus bloqueó Java. Si continúa, pulsa Parar el juego y envía lo que haya en la pestaña Logs.
Aventura|Adventure|Aventura
Desafiante|Challenging|Desafiante
Combate|Combat|Combate
Tudo e mais alguma coisa|Kitchen sink|De todo un poco
Leve|Lightweight|Ligero
Magia|Magic|Magia
Multijogador|Multiplayer|Multijugador
Otimização|Optimisation|Optimización
Missões|Quests|Misiones
Tecnologia|Technology|Tecnología
Adicionar servidor|Add server|Añadir servidor
Personaliza o launcher e o jogo. As mudanças aplicam-se logo.|Customise the launcher and the game. Changes apply instantly.|Personaliza el launcher y el juego. Los cambios se aplican al momento.
Geral|General|General
Jogo|Game|Juego
O Sleep arranca escondido na bandeja quando ligas o computador.|Sleep starts hidden in the tray when you turn on the computer.|Sleep arranca oculto en la bandeja al encender el ordenador.
Manter na bandeja ao fechar|Keep in the tray when closing|Mantener en la bandeja al cerrar
Fechar a janela deixa o Sleep a correr, para abrir mais depressa da próxima vez.|Closing the window keeps Sleep running, so it opens faster next time.|Cerrar la ventana deja Sleep en marcha, para que abra más rápido la próxima vez.
Animação de abertura|Opening animation|Animación de apertura
Mostra a animação do Sleep uma vez por dia.|Shows the Sleep animation once a day.|Muestra la animación de Sleep una vez al día.
Reduzir animações|Reduce animations|Reducir animaciones
Desliga as transições da interface.|Turns off interface transitions.|Desactiva las transiciones de la interfaz.
Tamanho da interface|Interface size|Tamaño de la interfaz
Modo FPS máximo|Maximum FPS mode|Modo FPS máximo
Desliga shaders, nuvens, sombras e VSync e tira o limite de FPS em todas as instâncias. Desligar repõe o que tinhas.|Turns off shaders, clouds, shadows and VSync and removes the FPS limit in every instance. Turning it off restores what you had.|Desactiva shaders, nubes, sombras y VSync y quita el límite de FPS en todas las instancias. Al desactivarlo se restaura lo que tenías.
Esconder o launcher ao jogar|Hide the launcher while playing|Ocultar el launcher al jugar
Liberta a placa gráfica enquanto jogas. O launcher volta quando fechas o jogo.|Frees the graphics card while you play. The launcher comes back when you close the game.|Libera la tarjeta gráfica mientras juegas. El launcher vuelve al cerrar el juego.
Mods de desempenho em instâncias novas|Performance mods in new instances|Mods de rendimiento en instancias nuevas
Liga por defeito a opção de instalar mods de FPS ao criar uma instância.|Turns on the option to install FPS mods by default when creating an instance.|Activa por defecto la opción de instalar mods de FPS al crear una instancia.
Memória por defeito|Default memory|Memoria por defecto
Versão|Version|Versión
Pasta do launcher|Launcher folder|Carpeta del launcher
Instâncias, mundos e definições.|Instances, worlds and settings.|Instancias, mundos y ajustes.
Limpar cache|Clear cache|Limpiar caché
Limpar|Clear|Limpiar
Fundos das instâncias e ficheiros temporários.|Instance backgrounds and temporary files.|Fondos de las instancias y archivos temporales.
Cache limpa.|Cache cleared.|Caché limpiada.
Já tens a versão mais recente.|You already have the latest version.|Ya tienes la versión más reciente.
Escolhe um modpack da Modrinth ou da CurseForge. Fica numa instância nova, pronta a jogar.|Pick a modpack from Modrinth or CurseForge. It goes into a new instance, ready to play.|Elige un modpack de Modrinth o CurseForge. Se crea una instancia nueva, lista para jugar.
Pesquisar modpacks…|Search modpacks…|Buscar modpacks…
Todas as versões|All versions|Todas las versiones
Todos|All|Todos
Carregar mais|Load more|Cargar más
Sem resultados.|No results.|Sin resultados.
A descarregar o modpack…|Downloading the modpack…|Descargando el modpack…
Modpack instalado. Carrega em Jogar para instalar o jogo.|Modpack installed. Press Play to install the game.|Modpack instalado. Pulsa Jugar para instalar el juego.
A CurseForge não está disponível nesta versão.|CurseForge is not available in this version.|CurseForge no está disponible en esta versión.
Erro: A CurseForge não está disponível nesta versão|Error: CurseForge is not available in this version|Error: CurseForge no está disponible en esta versión
Faltam alguns ficheiros|Some files are missing|Faltan algunos archivos
O modpack ficou instalado, mas os autores destes ficheiros só deixam descarregar no site da CurseForge. Descarrega-os e põe-nos na pasta mods da instância.|The modpack is installed, but the authors of these files only allow downloads on the CurseForge site. Download them and put them in the instance's mods folder.|El modpack se ha instalado, pero los autores de estos archivos solo permiten descargarlos en la web de CurseForge. Descárgalos y ponlos en la carpeta mods de la instancia.
Copiar detalhes|Copy details|Copiar detalles
Detalhes copiados.|Details copied.|Detalles copiados.
Esta conta ainda não tem perfil Xbox|This account has no Xbox profile yet|Esta cuenta aún no tiene perfil de Xbox
Entra uma vez em xbox.com com esta conta, cria o teu Gamertag e volta a tentar.|Sign in once at xbox.com with this account, create your Gamertag and try again.|Entra una vez en xbox.com con esta cuenta, crea tu Gamertag e inténtalo de nuevo.
Criar perfil Xbox|Create Xbox profile|Crear perfil de Xbox
Conta de menor sem família Microsoft|Child account without a Microsoft family|Cuenta de menor sin familia Microsoft
Um adulto tem de adicionar esta conta a um grupo familiar da Microsoft. Depois tenta outra vez.|An adult must add this account to a Microsoft family group. Then try again.|Un adulto debe añadir esta cuenta a un grupo familiar de Microsoft. Después inténtalo de nuevo.
Abrir Família Microsoft|Open Microsoft Family|Abrir Familia Microsoft
O controlo parental está a bloquear esta conta|Parental controls are blocking this account|El control parental está bloqueando esta cuenta
Um adulto da família tem de permitir o jogo online nesta conta.|An adult in the family must allow online play on this account.|Un adulto de la familia debe permitir el juego online en esta cuenta.
Esta conta não tem o Minecraft: Java Edition|This account doesn't have Minecraft: Java Edition|Esta cuenta no tiene Minecraft: Java Edition
Confirma que estás a entrar com a conta Microsoft onde compraste o jogo. Sem o jogo só podes usar uma conta cracked.|Make sure you are signing in with the Microsoft account that bought the game. Without the game you can only use a cracked account.|Comprueba que entras con la cuenta Microsoft con la que compraste el juego. Sin el juego solo puedes usar una cuenta cracked.
Abrir o site do Minecraft|Open the Minecraft site|Abrir la web de Minecraft
Falta criar o teu nome no Minecraft|You still need to create your Minecraft name|Falta crear tu nombre en Minecraft
Esta conta tem o jogo, mas ainda não escolheu um nome. Cria-o no site do Minecraft e volta a tentar.|This account owns the game but has not picked a name yet. Create it on the Minecraft site and try again.|Esta cuenta tiene el juego, pero aún no ha elegido un nombre. Créalo en la web de Minecraft e inténtalo de nuevo.
Criar o nome|Create the name|Crear el nombre
Falta aceitar os termos do Xbox|You still need to accept the Xbox terms|Falta aceptar los términos de Xbox
Entra em xbox.com com esta conta, aceita os termos e volta a tentar.|Sign in at xbox.com with this account, accept the terms and try again.|Entra en xbox.com con esta cuenta, acepta los términos e inténtalo de nuevo.
Abrir xbox.com|Open xbox.com|Abrir xbox.com
O Xbox Live não está disponível no teu país|Xbox Live is not available in your country|Xbox Live no está disponible en tu país
A Microsoft não permite entrar com esta conta a partir da região dela.|Microsoft does not allow signing in with this account from its region.|Microsoft no permite entrar con esta cuenta desde su región.
A Microsoft pede verificação de idade|Microsoft requires age verification|Microsoft pide verificación de edad
Conclui a verificação de adulto em xbox.com e volta a tentar.|Complete the adult verification at xbox.com and try again.|Completa la verificación de adulto en xbox.com e inténtalo de nuevo.
Esta conta está suspensa no Xbox|This account is suspended on Xbox|Esta cuenta está suspendida en Xbox
A Microsoft bloqueou esta conta. Só o suporte do Xbox consegue resolver isto.|Microsoft has blocked this account. Only Xbox support can solve this.|Microsoft ha bloqueado esta cuenta. Solo el soporte de Xbox puede resolverlo.
Abrir suporte Xbox|Open Xbox support|Abrir soporte de Xbox
Demasiadas tentativas|Too many attempts|Demasiados intentos
A Microsoft limitou os pedidos. Espera alguns minutos e tenta outra vez.|Microsoft is limiting requests. Wait a few minutes and try again.|Microsoft ha limitado las peticiones. Espera unos minutos e inténtalo de nuevo.
Sem ligação aos servidores da Microsoft|No connection to Microsoft's servers|Sin conexión con los servidores de Microsoft
Verifica a internet, a VPN e o antivírus e tenta outra vez.|Check your internet, VPN and antivirus and try again.|Comprueba internet, la VPN y el antivirus e inténtalo de nuevo.
Tempo esgotado|Timed out|Tiempo agotado
A janela de entrada esteve aberta demasiado tempo. Tenta outra vez.|The sign-in window was open for too long. Try again.|La ventana de inicio de sesión estuvo abierta demasiado tiempo. Inténtalo de nuevo.
Não foi possível abrir a janela de entrada|Couldn't open the sign-in window|No se pudo abrir la ventana de inicio de sesión
Fecha o launcher, volta a abri-lo e tenta outra vez.|Close the launcher, open it again and try again.|Cierra el launcher, ábrelo de nuevo e inténtalo otra vez.
A Microsoft recusou a entrada|Microsoft refused the sign-in|Microsoft rechazó el inicio de sesión
Tenta outra vez e confirma a conta e a palavra-passe.|Try again and check your account and password.|Inténtalo de nuevo y comprueba la cuenta y la contraseña.
A Microsoft não concluiu a entrada|Microsoft didn't finish the sign-in|Microsoft no completó el inicio de sesión
Tenta outra vez. Se continuar, envia os detalhes abaixo.|Try again. If it keeps happening, send the details below.|Inténtalo de nuevo. Si continúa, envía los detalles de abajo.
A Microsoft recusou o launcher|Microsoft refused the launcher|Microsoft rechazó el launcher
O problema está do lado do launcher, não da tua conta. Envia os detalhes abaixo ao criador do Sleep.|The problem is on the launcher's side, not your account. Send the details below to the creator of Sleep.|El problema está en el launcher, no en tu cuenta. Envía los detalles de abajo al creador de Sleep.
Os servidores responderam com um erro|The servers answered with an error|Los servidores respondieron con un error
Pode ser uma falha temporária. Tenta outra vez e, se continuar, envia os detalhes abaixo.|It may be a temporary failure. Try again and, if it continues, send the details below.|Puede ser un fallo temporal. Inténtalo de nuevo y, si continúa, envía los detalles de abajo.
A atualização não ficou instalada|The update was not installed|La actualización no se instaló
Continuar|Continue|Continuar
Move o Sleep Launcher para a pasta Aplicações|Move Sleep Launcher to the Applications folder|Mueve Sleep Launcher a la carpeta Aplicaciones
O macOS não deixa atualizar uma app aberta a partir do disco de instalação ou dos Downloads. Fecha o Sleep, arrasta-o para Aplicações e abre-o de lá.|macOS doesn't allow updating an app opened from the install disk or Downloads. Close Sleep, drag it to Applications and open it from there.|macOS no permite actualizar una app abierta desde el disco de instalación o Descargas. Cierra Sleep, arrástralo a Aplicaciones y ábrelo desde allí.
O servidor de amigos recusou a ligação. Tenta mais tarde.|The friends server refused the connection. Try again later.|El servidor de amigos rechazó la conexión. Inténtalo más tarde.
A preparar o jogo… (a primeira vez demora um pouco)|Getting the game ready… (the first time takes a while)|Preparando el juego… (la primera vez tarda un poco)
A Mojang limitou os pedidos de capa. Espera cerca de 1 minuto e tenta outra vez.|Mojang is limiting cape requests. Wait about a minute and try again.|Mojang limitó las peticiones de capa. Espera un minuto e inténtalo de nuevo.
Fundo da página inicial|Home page background|Fondo de la página de inicio
Cena 3D que aparece atrás do teu boneco. Automático: Natal de 1 de novembro a 31 de dezembro, o resto do ano a cena normal.|3D scene shown behind your character. Automatic: Christmas from 1 November to 31 December, the normal scene the rest of the year.|Escena 3D que aparece detrás de tu personaje. Automático: Navidad del 1 de noviembre al 31 de diciembre, el resto del año la escena normal.
Automático|Automatic|Automático
Natal|Christmas|Navidad
FNAF|FNAF|FNAF
Imagem clássica|Classic image|Imagen clásica
Esta app tem uma nova versão|This app has a new version|Esta app tiene una versión nueva
Por favor atualiza a app para continuar a jogar. Queres atualizar agora?|Please update the app to keep playing. Do you want to update now?|Actualiza la app para seguir jugando. ¿Quieres actualizar ahora?
Não, fechar a app|No, close the app|No, cerrar la app
Sim, atualizar|Yes, update|Sí, actualizar
Fechar a app|Close the app|Cerrar la app
Tentar outra vez|Try again|Intentar de nuevo
Instala e abre (mcpelauncher)|Installs and opens it (mcpelauncher)|Lo instala y lo abre (mcpelauncher)
A descarregar o mcpelauncher para o Bedrock (só da primeira vez)…|Downloading mcpelauncher for Bedrock (first time only)…|Descargando mcpelauncher para Bedrock (solo la primera vez)…
Pronto. A abrir o Bedrock. Entra com a conta Google Play onde o compraste.|Done. Opening Bedrock. Sign in with the Google Play account where you bought it.|Listo. Abriendo Bedrock. Entra con la cuenta de Google Play donde lo compraste.
Não foi possível preparar o Bedrock: |Could not set up Bedrock: |No se pudo preparar Bedrock: 
Minecraft Bedrock|Minecraft Bedrock|Minecraft Bedrock
Abre o Bedrock instalado|Opens the Bedrock you installed|Abre el Bedrock instalado
Como jogar Bedrock aqui|How to play Bedrock here|Cómo jugar Bedrock aquí
Ver como|See how|Ver cómo
Abrir|Open|Abrir
Não consegui abrir o Bedrock. Instala-o pela Microsoft Store.|Could not open Bedrock. Install it from the Microsoft Store.|No pude abrir Bedrock. Instálalo desde la Microsoft Store.
O Bedrock tem de estar comprado no Google Play. O mcpelauncher instala-o e abre-o.|Bedrock must be bought on Google Play. mcpelauncher installs and opens it.|Bedrock debe estar comprado en Google Play. mcpelauncher lo instala y lo abre.
Ícone da app|App icon|Icono de la app
Muda o ícone do Sleep no Dock e na barra de tarefas. Escolhe um, ou carrega uma imagem tua.|Change the Sleep icon in the Dock and taskbar. Pick one, or upload your own image.|Cambia el icono de Sleep en el Dock y la barra de tareas. Elige uno o sube tu imagen.
Não foi possível mudar o ícone.|Could not change the icon.|No se pudo cambiar el icono.
A atualizar o Sleep Launcher|Updating Sleep Launcher|Actualizando Sleep Launcher
Não foi possível atualizar. Tenta outra vez mais tarde.|Could not update. Try again later.|No se pudo actualizar. Inténtalo más tarde.
Padrão|Default|Predeterminado
Noite|Night|Noche
Pôr do sol|Sunset|Atardecer
Oceano|Ocean|Océano
Floresta|Forest|Bosque
Doce|Candy|Dulce
Ouro|Gold|Oro
Carvão|Charcoal|Carbón
Gelo|Ice|Hielo
Sangue|Blood|Sangre
Não foi possível abrir a janela de entrada. Tenta outra vez.|Could not open the sign-in window. Try again.|No se pudo abrir la ventana de inicio de sesión. Inténtalo de nuevo.
Escolhe a capa da tua conta Minecraft. Aparece no jogo e no boneco ao lado.|Pick your Minecraft account cape. It shows in game and on the character beside it.|Elige la capa de tu cuenta de Minecraft. Aparece en el juego y en el muñeco de al lado.
Esta conta não tem capas da Mojang.|This account has no Mojang capes.|Esta cuenta no tiene capas de Mojang.
Could not start Horizon. Try again.|Could not start Horizon. Try again.|No se pudo iniciar Horizon. Inténtalo de nuevo.
A abrir a janela de entrada da Microsoft…|Opening the Microsoft sign-in window…|Abriendo la ventana de inicio de sesión de Microsoft…
Não foi possível entrar com a Microsoft. Tenta outra vez.|Could not sign in with Microsoft. Try again.|No se pudo iniciar sesión con Microsoft. Inténtalo de nuevo.
Nova versão do launcher|New launcher version|Nueva versión del launcher
Atualizar agora|Update now|Actualizar ahora
Depois|Later|Después
A atualizar o launcher…|Updating the launcher…|Actualizando el launcher…
Galeria|Gallery|Galería
Capturas|Screenshots|Capturas
Vídeos|Videos|Vídeos
Atualizar|Refresh|Actualizar
Ainda não há nada aqui|Nothing here yet|Todavía no hay nada aquí
As capturas de ecrã (F2) e os clips que gravares no jogo aparecem aqui.|Screenshots (F2) and clips you record in the game show up here.|Las capturas (F2) y los clips que grabes en el juego aparecen aquí.
Mostrar na pasta|Show in folder|Mostrar en la carpeta
Apagar mesmo?|Really delete?|¿Eliminar de verdad?
Apagado.|Deleted.|Eliminado.
Jogar|Play|Jugar
Instâncias|Instances|Instancias
Servidores|Servers|Servidores
Amigos|Friends|Amigos
Loja|Shop|Tienda
Personagem|Character|Personaje
Ligação privada|Private connection|Conexión privada
Definições|Settings|Ajustes
Acesso rápido|Quick access|Acceso rápido
A jogar|Playing|Jugando
Ausente|Away|Ausente
Ocupado|Busy|Ocupado
Invisível|Invisible|Invisible
Novidades|News|Novedades
Sem novidades agora.|No news right now.|Sin novedades ahora.
Notificações|Notifications|Notificaciones
Trocar de instância|Switch instance|Cambiar de instancia
Instância|Instance|Instancia
Arrasta para mudar a largura|Drag to change the width|Arrastra para cambiar el ancho
Arrasta para mudar a largura do menu (duplo clique repõe)|Drag to change the menu width (double-click resets)|Arrastra para cambiar el ancho del menú (doble clic restablece)
Cada instância tem os seus mods, packs e mundos.|Each instance has its own mods, packs and worlds.|Cada instancia tiene sus mods, packs y mundos.
Importar|Import|Importar
Nova instância|New instance|Nueva instancia
Minecraft em Rust|Minecraft in Rust|Minecraft en Rust
Instalar|Install|Instalar
Instalada|Installed|Instalada
Por instalar|Not installed yet|Sin instalar
Pesquisar instâncias…|Search instances…|Buscar instancias…
Aparecem no acesso rápido da página Jogar e entram direto no servidor (Minecraft 1.20 ou mais recente).|They show up in Quick access on the Play page and join the server directly (Minecraft 1.20 or newer).|Aparecen en el acceso rápido de la página Jugar y entran directo al servidor (Minecraft 1.20 o más reciente).
Adicionar|Add|Añadir
Offline ou sem resposta|Offline or not responding|Sin conexión o sin respuesta
Personalizar|Customise|Personalizar
Remover|Remove|Quitar
Pedidos|Requests|Solicitudes
Grupos|Groups|Grupos
Conversas|Chats|Conversaciones
Escolhe um amigo ou um grupo para conversar.|Pick a friend or a group to chat with.|Elige un amigo o un grupo para chatear.
A editar mensagem|Editing message|Editando mensaje
Cancelar|Cancel|Cancelar
Estado|Status|Estado
Adicionar amigo (nome)|Add friend (name)|Añadir amigo (nombre)
Escolhe um amigo ou um grupo|Pick a friend or a group|Elige un amigo o un grupo
Enviar|Send|Enviar
Compras com moedas; o que equipares vê-se no jogo, com o client Sleep, e os teus amigos também o veem.|You buy with coins; what you equip shows in the game with the Sleep client, and your friends see it too.|Compras con monedas; lo que equipes se ve en el juego, con el client Sleep, y tus amigos también lo ven.
Itens|Items|Objetos
Inventário|Inventory|Inventario
Baús|Crates|Cofres
Tudo|All|Todo
Destaques|Featured|Destacados
Promoções|Sales|Ofertas
Novo|New|Nuevo
Comprar|Buy|Comprar
Tens|Owned|Lo tienes
Equipar|Equip|Equipar
Equipado|Equipped|Equipado
Tirar|Remove|Quitar
Grátis|Free|Gratis
Obter|Get|Obtener
As tuas moedas|Your coins|Tus monedas
Pesquisar…|Search…|Buscar…
Capas|Capes|Capas
Trocar skin|Change skin|Cambiar skin
Ficheiro PNG 64x64.|PNG file 64x64.|Archivo PNG 64x64.
Skins Sleep (as que os outros jogadores do client veem) e capas da loja: separador Sleep.|Sleep skins (the ones other client players see) and shop capes: Sleep tab.|Skins Sleep (las que ven los demás jugadores del client) y capas de la tienda: pestaña Sleep.
Sair da conta|Sign out|Cerrar sesión
Ligação privada desligada|Private connection off|Conexión privada desactivada
Ligação privada ligada|Private connection on|Conexión privada activada
O servidor vê o teu endereço normal.|The server sees your normal address.|El servidor ve tu dirección normal.
Ligar|Turn on|Activar
Desligar|Turn off|Desactivar
País|Country|País
Mais rápido|Fastest|Más rápido
Portugal|Portugal|Portugal
Espanha|Spain|España
França|France|Francia
Alemanha|Germany|Alemania
Países Baixos|Netherlands|Países Bajos
Reino Unido|United Kingdom|Reino Unido
Itália|Italy|Italia
Polónia|Poland|Polonia
Suécia|Sweden|Suecia
Estados Unidos|United States|Estados Unidos
Canadá|Canada|Canadá
Brasil|Brazil|Brasil
Japão|Japan|Japón
Singapura|Singapore|Singapur
O que passa por aqui|What goes through here|Qué pasa por aquí
Só as ligações do Minecraft aos servidores. O login da Microsoft e o resto do computador ficam normais.|Only Minecraft's connections to servers. The Microsoft login and the rest of the computer stay normal.|Solo las conexiones de Minecraft a los servidores. El inicio de sesión de Microsoft y el resto del ordenador quedan normales.
Como funciona|How it works|Cómo funciona
O jogo liga-se através de um servidor no país que escolheste, por isso o servidor vê o endereço desse país.|The game connects through a server in the country you chose, so the server sees that country's address.|El juego se conecta a través de un servidor del país que elegiste, así que el servidor ve la dirección de ese país.
Muda o tema do launcher. As cores aplicam-se logo.|Change the launcher theme. Colours apply instantly.|Cambia el tema del launcher. Los colores se aplican al instante.
Temas|Themes|Temas
Cor de destaque|Accent colour|Color de acento
Cor de fundo|Background colour|Color de fondo
Repor|Reset|Restablecer
Fonte|Font|Fuente
Idioma|Language|Idioma
Sistema|System|Sistema
Arredondada|Rounded|Redondeada
Serifa|Serif|Serif
Monoespaçada|Monospace|Monoespaciada
Compacta|Compact|Compacta
Máquina|Typewriter|Máquina
Carregar fonte…|Load font…|Cargar fuente…
Repor a fonte|Reset the font|Restablecer la fuente
Abrir com o computador|Open with the computer|Abrir con el ordenador
Avançado|Advanced|Avanzado
Login Microsoft|Microsoft login|Inicio de sesión de Microsoft
Guardar|Save|Guardar
Chave guardada neste computador. Cola outra para a trocar.|Key saved on this computer. Paste another to replace it.|Clave guardada en este ordenador. Pega otra para cambiarla.
Chave de API da CurseForge (console.curseforge.com). Fica só neste computador.|CurseForge API key (console.curseforge.com). It stays on this computer only.|Clave de API de CurseForge (console.curseforge.com). Se queda solo en este ordenador.
Amigos e chat|Friends and chat|Amigos y chat
Chave do cliente do site (só se o administrador a ligou).|Site client key (only if the administrator turned it on).|Clave de cliente del sitio (solo si el administrador la activó).
Endereço do manifesto (JSON no teu site)|Manifest address (JSON on your site)|Dirección del manifiesto (JSON en tu sitio)
Meia-noite|Midnight|Medianoche
Oceano|Ocean|Océano
Floresta|Forest|Bosque
Pôr do sol|Sunset|Atardecer
Rosa|Rose|Rosa
Violeta|Violet|Violeta
Grafite|Graphite|Grafito
Carmesim|Crimson|Carmesí
Ouro|Gold|Oro
Gelo|Ice|Hielo
Chave de API|API key|Clave de API
Chave do cliente (opcional)|Client key (optional)|Clave de cliente (opcional)
Baú do Tesouro|Treasure Chest|Cofre del Tesoro
Baú Mimic|Mimic Chest|Cofre Mimic
Presente de Natal|Christmas Present|Regalo de Navidad
Sempre disponível|Always available|Siempre disponible
Comum / Raro / Épico / Lendário|Common / Rare / Epic / Legendary|Común / Raro / Épico / Legendario
Abrir|Open|Abrir
Fora de época|Out of season|Fuera de temporada
Os baús dão só cosméticos (emotes, auras e outros itens). Se já tiveres o item, recebes 40 % do preço em moedas.|Crates only give cosmetics (emotes, auras and other items). If you already own the item you get 40 % of its price back in coins.|Los cofres solo dan cosméticos (emotes, auras y otros objetos). Si ya tienes el objeto, recibes el 40 % del precio en monedas.
Sem capa|No cape|Sin capa
Esta conta não tem capas.|This account has no capes.|Esta cuenta no tiene capas.
Capa da loja|Shop cape|Capa de la tienda
As capas do Sleep compram-se na Loja e veem-se no jogo com o client Sleep.|Sleep capes are bought in the Shop and show in the game with the Sleep client.|Las capas de Sleep se compran en la Tienda y se ven en el juego con el client Sleep.
Skins Sleep|Sleep skins|Skins Sleep
Ficheiro PNG 64x64. Os outros jogadores com o client Sleep veem esta skin. A skin da conta Microsoft muda-se no separador Skins.|PNG file 64x64. Other players with the Sleep client see this skin. The Microsoft account skin is changed in the Skins tab.|Archivo PNG 64x64. Los demás jugadores con el client Sleep ven esta skin. La skin de la cuenta Microsoft se cambia en la pestaña Skins.
Usar|Use|Usar
Capas pessoais antigas|Old personal capes|Capas personales antiguas
Já não se enviam capas novas, mas as que tinhas continuam aqui.|New capes can't be uploaded any more, but the ones you had are still here.|Ya no se envían capas nuevas, pero las que tenías siguen aquí.
Nenhuma|None|Ninguna
Apagar|Delete|Borrar
Um jogo à parte, com os seus próprios mods, packs e mundos.|A separate game with its own mods, packs and worlds.|Un juego aparte, con sus propios mods, packs y mundos.
Ícone|Icon|Icono
Carregar imagem|Upload image|Subir imagen
Nome|Name|Nombre
Versão do Minecraft|Minecraft version|Versión de Minecraft
Antigas|Old|Antiguas
Minecraft 26.3 reescrito em Rust. Arranca muito depressa.|Minecraft 26.3 rewritten in Rust. Starts very fast.|Minecraft 26.3 reescrito en Rust. Arranca muy rápido.
Leve e rápido. Recomendado para o Sleep.|Light and fast. Recommended for Sleep.|Ligero y rápido. Recomendado para Sleep.
Alternativa ao Fabric.|An alternative to Fabric.|Alternativa a Fabric.
Mods clássicos.|Classic mods.|Mods clásicos.
O sucessor do Forge.|The successor to Forge.|El sucesor de Forge.
Minecraft sem mods.|Minecraft without mods.|Minecraft sin mods.
Otimizar o desempenho|Optimise performance|Optimizar el rendimiento
Instala sozinho os mods de FPS certos para este loader (Sodium, Lithium, FerriteCore...) e usa argumentos de Java afinados.|Automatically installs the right FPS mods for this loader (Sodium, Lithium, FerriteCore...) and uses tuned Java arguments.|Instala solo los mods de FPS adecuados para este loader (Sodium, Lithium, FerriteCore...) y usa argumentos de Java ajustados.
Criar instância|Create instance|Crear instancia
Ex.: Survival com amigos|E.g. Survival with friends|Ej.: Survival con amigos
O Horizon (Minecraft em Rust) só corre a versão|Horizon (Minecraft in Rust) only runs version|Horizon (Minecraft en Rust) solo ejecuta la versión
Instalar o Horizon|Install Horizon|Instalar Horizon
Importar de outros launchers|Import from other launchers|Importar de otros launchers
Copio os mods, packs, shaders, mundos e definições para o Sleep; as originais ficam como estão.|I copy the mods, packs, shaders, worlds and settings to Sleep; the originals stay as they are.|Copio los mods, packs, shaders, mundos y ajustes a Sleep; los originales se quedan como están.
já não está instalado|no longer installed|ya no está instalado
Escolher todas|Select all|Elegir todas
Tirar todas|Select none|Quitar todas
Agora não|Not now|Ahora no
Não voltar a perguntar|Don't ask again|No volver a preguntar
Limpar restos|Clean up leftovers|Limpiar restos
Limpar restos de launchers antigos?|Clean up leftovers of old launchers?|¿Limpiar restos de launchers antiguos?
Estes launchers já não estão instalados neste computador. Se tiveres mundos importantes aqui, importa-os primeiro para o Sleep.|These launchers are no longer installed on this computer. If you have important worlds here, import them into Sleep first.|Estos launchers ya no están instalados en este ordenador. Si tienes mundos importantes aquí, impórtalos primero a Sleep.
Voltar|Back|Volver
Mandar para o Lixo|Move to Trash|Mover a la papelera
Personalizar servidor|Customise server|Personalizar servidor
Logo|Logo|Logo
Escolher imagem|Choose image|Elegir imagen
Banner|Banner|Banner
Sem banner|No banner|Sin banner
Mundos|Worlds|Mundos
Capturas|Screenshots|Capturas
Consola|Console|Consola
Instalados|Installed|Instalados
Explorar|Explore|Explorar
Procurar conteúdo|Browse content|Buscar contenido
Procurar atualizações|Check for updates|Buscar actualizaciones
Nada instalado. Vai a Explorar.|Nothing installed. Go to Explore.|Nada instalado. Ve a Explorar.
Abrir pasta|Open folder|Abrir carpeta
Apagar instância|Delete instance|Borrar instancia
Categorias|Categories|Categorías
Sem resultados para esta versão.|No results for this version.|Sin resultados para esta versión.
Instalar em|Install in|Instalar en
Entra para jogar, ver os teus amigos e usar a tua loja, skins e capas.|Sign in to play, see your friends and use your shop, skins and capes.|Entra para jugar, ver a tus amigos y usar tu tienda, skins y capas.
Entrar com Microsoft|Sign in with Microsoft|Entrar con Microsoft
Entrar com conta cracked|Sign in with a cracked account|Entrar con cuenta cracked
Reportar bugs|Report bugs|Reportar errores
Conta cracked só funciona em servidores em modo offline. É preciso entrar com uma das duas para jogar.|A cracked account only works on offline-mode servers. You must sign in with one of the two to play.|Una cuenta cracked solo funciona en servidores en modo offline. Hay que entrar con una de las dos para jugar.
Conta cracked|Cracked account|Cuenta cracked
Escolhe o teu nome (3 a 16 letras, números ou _).|Pick your name (3 to 16 letters, numbers or _).|Elige tu nombre (3 a 16 letras, números o _).
Entrar|Sign in|Entrar
Abre|Open|Abre
e escreve este código:|and type this code:|y escribe este código:
Copiar código|Copy code|Copiar código
Abrir a página|Open the page|Abrir la página
Esta janela fecha sozinha quando entrares.|This window closes by itself when you sign in.|Esta ventana se cierra sola cuando entres.
A pedir o código à Microsoft…|Asking Microsoft for the code…|Pidiendo el código a Microsoft…
Conta Minecraft|Minecraft account|Cuenta de Minecraft
Conta offline|Offline account|Cuenta offline
Oficial|Official|Oficial
Adicionar conta Microsoft|Add Microsoft account|Añadir cuenta Microsoft
Adicionar conta offline|Add offline account|Añadir cuenta offline
Personagem e skins|Character and skins|Personaje y skins
Sem instâncias|No instances|Sin instancias
Criar instância|Create instance|Crear instancia
Começa por aqui|Start here|Empieza aquí
Instalar e jogar|Install and play|Instalar y jugar
Ainda não tens amigos. Adiciona na página Amigos.|You have no friends yet. Add some on the Friends page.|Aún no tienes amigos. Añádelos en la página Amigos.
Pesquisar|Search|Buscar
Chat|Chat|Chat
Criar|Create|Crear
Fechar|Close|Cerrar
Tentar outra vez|Try again|Intentar otra vez
A carregar…|Loading…|Cargando…
Mostrar|Show|Mostrar
Ainda não tens servidores. Adiciona um acima.|You have no servers yet. Add one above.|Aún no tienes servidores. Añade uno arriba.
Nome do servidor|Server name|Nombre del servidor
Tirar|Remove|Quitar
Confirmar?|Confirm?|¿Confirmar?
Jogador|Player|Jugador
jogadores|players|jugadores
A verificar…|Checking…|Comprobando…
Servidor online|Server online|Servidor en línea
Descarregar|Download|Descargar
Atualizar|Update|Actualizar
Atualizar tudo|Update all|Actualizar todo
Ligado|On|Activado
Desligado|Off|Desactivado
A instalar…|Installing…|Instalando…
Instalação concluída|Installation finished|Instalación terminada
Esta ligação não pode ser aberta pelo launcher.|The launcher can't open this link.|El launcher no puede abrir este enlace.
Ainda não tens nada aqui. Compra itens na Loja ou abre baús.|You have nothing here yet. Buy items in the Shop or open crates.|Aún no tienes nada aquí. Compra objetos en la Tienda o abre cofres.
Ainda não há nada aqui.|There is nothing here yet.|Aún no hay nada aquí.
Os baús ainda não estão ativos no site. Não gastaste nada.|Crates aren't active on the site yet. You spent nothing.|Los cofres aún no están activos en el sitio. No gastaste nada.
Moedas insuficientes.|Not enough coins.|Monedas insuficientes.
Este baú está fora de época.|This crate is out of season.|Este cofre está fuera de temporada.
Abrir outro|Open another|Abrir otro
Já tinhas este item|You already had this item|Ya tenías este objeto
Já está no teu inventário.|It's already in your inventory.|Ya está en tu inventario.
Comum|Common|Común
Raro|Rare|Raro
Épico|Epic|Épico
Lendário|Legendary|Legendario
Escolhe a versão|Pick the version|Elige la versión
escolhe a versão|pick the version|elige la versión
Nova|New|Nueva
Ou arrasta uma imagem|Or drop an image|O arrastra una imagen
Tema|Theme|Tema
Mudar|Change|Cambiar
Aplicar|Apply|Aplicar
Nome de utilizador|Username|Nombre de usuario
Minecraft em|Minecraft in|Minecraft en
Instalar e jogar|Install and play|Instalar y jugar
Mundo|World|Mundo
Captura|Screenshot|Captura
Servidor|Server|Servidor
Pasta|Folder|Carpeta
Apagar instância?|Delete instance?|¿Borrar instancia?
Não deu para ler as skins:|Couldn't read the skins:|No se pudieron leer las skins:
Ainda não enviaste nenhuma skin.|You haven't uploaded any skin yet.|Aún no has subido ninguna skin.
Entra com a tua conta Microsoft para veres os teus amigos.|Sign in with your Microsoft account to see your friends.|Entra con tu cuenta Microsoft para ver a tus amigos.
Preview|Preview|Vista previa
Online|Online|En línea
Offline|Offline|Sin conexión`;
const EN={},ES={};
TABLE.split("\n").forEach(l=>{const p=l.split("|");if(p.length>=3){EN[p[0]]=p[1];ES[p[0]]=p[2]}});
/* textos com números ou nomes (a parte variável fica como está) */
const PATS=[
 [/^Jogar (.+)$/,"Play $1","Jugar $1"],
 [/^Faltam (\d+)$/,"$1 short","Faltan $1"],
 [/^Importar (\d+)$/,"Import $1","Importar $1"],
 [/^Amigos \((\d+)\)$/,"Friends ($1)","Amigos ($1)"],
 [/^Grupos \((\d+)\)$/,"Groups ($1)","Grupos ($1)"],
 [/^Pedidos \((\d+)\)$/,"Requests ($1)","Solicitudes ($1)"],
 [/^(\d+) moedas$/,"$1 coins","$1 monedas"],
 [/^(\d+) encontradas$/,"$1 found","$1 encontradas"],
 [/^(\d+) escolhidas$/,"$1 selected","$1 elegidas"],
 [/^(\d+) de launchers que já não existem$/,"$1 from launchers that no longer exist","$1 de launchers que ya no existen"],
 [/^(\d+)\/(\d+) jogadores$/,"$1/$2 players","$1/$2 jugadores"],
 [/^A jogar (.+)$/,"Playing $1","Jugando $1"],
 [/^Encontrei (\d+) instâncias? em (\d+) launchers?\.(.*)$/,(m,a,b,c)=>`I found ${a} instance${a==1?"":"s"} in ${b} launcher${b==1?"":"s"}.${c.replace("Copio os mods, packs, shaders, mundos e definições para o Sleep; as originais ficam como estão.","I copy the mods, packs, shaders, worlds and settings to Sleep; the originals stay as they are.")}`,(m,a,b,c)=>`Encontré ${a} instancia${a==1?"":"s"} en ${b} launcher${b==1?"":"s"}.${c.replace("Copio os mods, packs, shaders, mundos e definições para o Sleep; as originais ficam como estão.","Copio los mods, packs, shaders, mundos y ajustes a Sleep; los originales se quedan como están.")}`],
 [/^Vou mandar (\d+) pastas? \((\d+) MB\) para o Lixo\. Dá para as recuperar de lá\.$/,"I'll move $1 folder(s) ($2 MB) to the Trash. You can recover them from there.","Voy a mover $1 carpeta(s) ($2 MB) a la papelera. Puedes recuperarlas desde allí."],
 [/^(.+) · escolhe a versão$/,"$1 · pick the version","$1 · elige la versión"],
 [/^(.+?) · (\d+) MB$/,"$1 · $2 MB","$1 · $2 MB"],
 [/^Mandei (\d+) pastas? para o Lixo\.$/,"Moved $1 folder(s) to the Trash.","Moví $1 carpeta(s) a la papelera."],
 [/^Automático usa (.+) neste computador\.$/,"Automatic uses $1 on this computer.","Automático usa $1 en este ordenador."],
 [/^Para as instâncias sem memória própria\. Automático usa (.+) neste computador\.$/,"For instances without their own memory. Automatic uses $1 on this computer.","Para las instancias sin memoria propia. Automático usa $1 en este ordenador."],
 [/^Podes libertar (.+)\.$/,"You can free $1.","Puedes liberar $1."],
 [/^Continuas na versão (.*)\. Descarrega o instalador da versão (.*) e instala-o por cima\.$/,"You are still on version $1. Download the installer for version $2 and install it over this one.","Sigues en la versión $1. Descarga el instalador de la versión $2 e instálalo encima."],
 [/^Sleep Launcher v(.+)$/,"Sleep Launcher v$1","Sleep Launcher v$1"],
 [/^Não foi possível descarregar o Sleep \((.+)\)\. Verifica a internet e carrega em Jogar outra vez\.$/,"Couldn't download Sleep ($1). Check your internet and press Play again.","No se pudo descargar Sleep ($1). Comprueba internet y pulsa Jugar otra vez."],
 [/^Importei (\d+) instâncias?\..*$/,"Imported $1 instance(s). The game installs when you press Play.","Importé $1 instancia(s). El juego se instala al pulsar Jugar."],
 [/^A criar (.+)…$/,"Creating $1…","Creando $1…"],
 [/^A otimizar (.+): (.+)…$/,"Optimising $1: $2…","Optimizando $1: $2…"],
 [/^Otimização: (\d+) mods? de desempenho instalados? em (.+)\.$/,"Optimisation: $1 performance mod(s) installed in $2.","Optimización: $1 mod(s) de rendimiento instalado(s) en $2."],
 [/^Conta mudada para (.+)\.$/,"Switched to $1.","Cuenta cambiada a $1."],
 [/^Vai ligar-se sozinha quando abrires o jogo · (.+)$/,"It connects by itself when you open the game · $1","Se conectará sola al abrir el juego · $1"],
 [/^Instalação: (.+)$/,"Installing: $1","Instalando: $1"],
 [/^(.+) · (\d+)%$/,"$1 · $2%","$1 · $2%"],
 [/^Importar (.+)$/,"Import $1","Importar $1"],
 [/^Abrir (.+)$/,"Open $1","Abrir $1"],
 [/^Instalar (.+)$/,"Install $1","Instalar $1"],
 [/^Skin aplicada.*$/,"Skin applied in the launcher. For other players to see it in the game, also upload it in the Sleep tab.","Skin aplicada en el launcher. Para que otros jugadores la vean en el juego, súbela también en la pestaña Sleep."],
 [/^Ligação privada ligada\.$/,"Private connection on.","Conexión privada activada."],
 [/^Ligação privada desligada\.$/,"Private connection off.","Conexión privada desactivada."],
 [/^Código copiado\.$/,"Code copied.","Código copiado."],
 [/^Nada importado\.$/,"Nothing imported.","Nada importado."],
 [/^Skin atualizada\.$/,"Skin updated.","Skin actualizada."],
 [/^Abre (.+) e escreve este código:$/,"Open $1 and type this code:","Abre $1 y escribe este código:"]
];
/* a verdade está em settings.json (ver KL.init no arranque); isto é só o valor provisório até o Rust responder */
let lang="en";try{lang=localStorage.getItem("kubo.lang")||"en"}catch(e){}
const ORIG=new WeakMap(),LAST=new WeakMap();
function tr(s){if(lang=="pt"||!s)return s;const d=lang=="es"?ES:EN,m=s.match(/^(\s*)([\s\S]*?)(\s*)$/),k=m?m[2]:s;if(!k)return s;
 let t=d[k];if(t!==undefined)return m[1]+t+m[3];
 for(const p of PATS){const r=p[0].exec(k);if(r){const o=lang=="es"?p[2]:p[1];if(o==="$&")return s;return m[1]+(typeof o=="function"?o(...r):k.replace(p[0],o))+m[3]}}
 return s}
function node(n){if(n.nodeType==3){const v=n.nodeValue;if(LAST.get(n)===v&&ORIG.has(n)){const o=ORIG.get(n),t=tr(o);if(t!==v){LAST.set(n,t);n.nodeValue=t}return}
  ORIG.set(n,v);const t=tr(v);LAST.set(n,t);if(t!==v)n.nodeValue=t}
 else if(n.nodeType==1){if(/^(SCRIPT|STYLE|CANVAS|SVG|svg)$/.test(n.tagName)||n.closest&&n.closest("[data-notr]"))return;
  for(const a of ["placeholder","title","aria-label"]){if(n.hasAttribute&&n.hasAttribute(a)){const key="__o_"+a,cur=n.getAttribute(a);if(n[key]===undefined||n["__l_"+a]!==cur){n[key]=cur}const t=tr(n[key]);n["__l_"+a]=t;if(t!==cur)n.setAttribute(a,t)}}
  for(const c of n.childNodes)node(c)}}
let busy=false;
const mo=new MutationObserver(ms=>{if(busy)return;busy=true;try{for(const m of ms){if(m.type=="childList")m.addedNodes.forEach(node);else if(m.type=="characterData")node(m.target);else if(m.type=="attributes")node(m.target)}}finally{busy=false}});
function start(){mo.observe(document.documentElement,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:["placeholder","title","aria-label"]});node(document.body)}
window.KL={langs:LANGS,get:()=>lang,t:tr,
 /* escolhido pela pessoa: guarda no ficheiro de definições, que sobrevive ao fechar a app e não depende do espaço do localStorage */
 set(c){apply(c);const A=window.__TAURI__;if(A)A.core.invoke("save_pref",{key:"lang",value:c}).catch(()=>{});if(window.render)render()},
 init(c){if(c!=lang)apply(c)}};
function apply(c){lang=c;try{localStorage.setItem("kubo.lang",c)}catch(e){}document.documentElement.lang=c;busy=true;try{node(document.body)}finally{busy=false}}
document.documentElement.lang=lang;
if(document.readyState=="loading")document.addEventListener("DOMContentLoaded",start);else start();
})();
