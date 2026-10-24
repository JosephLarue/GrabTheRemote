import { APP_NAME as APP, LEGAL, VOTE_COOLDOWN_S } from '@/config/app';

// Plain-language summary, one version per UI language. Have every version reviewed before launch
// (GDPR: operator based in France).

const MIN = VOTE_COOLDOWN_S / 60;

const Ext = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <a href={href} className="underline underline-offset-2" target="_blank" rel="noreferrer">
    {children}
  </a>
);
const YT_TERMS = 'https://www.youtube.com/t/terms';
const GOOGLE_PRIVACY = 'https://policies.google.com/privacy';
const TWITCH_PRIVACY = 'https://www.twitch.tv/p/legal/privacy-notice/';

export const PRIVACY: Record<string, { title: string; body: React.ReactNode }> = {
  en: {
    title: 'Privacy',
    body: (
      <>
        <p>
          {APP} has no accounts. Here is everything we process and why. Contact for any request: {LEGAL.contactEmail}.
        </p>
        <h2>Your IP address</h2>
        <p>
          To allow one vote every {MIN} minutes per connection, we turn your IP address into a scrambled code (a keyed
          hash) as soon as a request arrives. The raw IP is never stored. The code is kept in temporary memory and expires
          automatically: after {MIN} minutes for votes, and after one video for skip and report votes. IPv6 addresses are
          shortened to their network prefix before hashing.
        </p>
        <h2>Bot protection</h2>
        <p>
          Votes, skips and reports go through Cloudflare Turnstile, which checks that you are human. Cloudflare processes
          technical data about your browser for that check.
        </p>
        <h2>What we keep</h2>
        <p>
          Public data about the videos that were played (title, channel, duration), how many people watched, and how they
          ended. None of it is linked to you.
        </p>
        <h2>Your browser</h2>
        <p>
          We keep a short list of videos you voted for in your browser&apos;s local storage, only so we can show confetti
          when one of them plays, and a cookie remembering the last room you visited. Neither leaves your device for any
          other purpose.
        </p>
        <h2>Private rooms</h2>
        <p>
          A private room keeps its name, settings and password until a day passes with nobody watching, or its streamer
          closes it. Entering the password (or creating the room) sets a cookie for that room only, so you don&apos;t
          have to type it again; it lasts 7 days and holds no personal data.
        </p>
        <h2>YouTube</h2>
        <p>
          {APP} uses YouTube API Services to look up public video details (title, channel, duration, views, category) and
          to play videos. By using {APP}, you agree to be bound by the <Ext href={YT_TERMS}>YouTube Terms of Service</Ext>
          . Videos play in the YouTube player using its privacy-enhanced mode (youtube-nocookie.com), and the{' '}
          <Ext href={GOOGLE_PRIVACY}>Google Privacy Policy</Ext> applies to it. {APP} never asks for access to your Google
          or YouTube account.
        </p>
        <h2>Twitch</h2>
        <p>
          The Twitch room plays live streams in Twitch&apos;s embedded player (player.twitch.tv), and the{' '}
          <Ext href={TWITCH_PRIVACY}>Twitch Privacy Notice</Ext> applies to it. {APP} uses the Twitch API to check
          whether a channel is live and to get its public details (name, stream title, category, viewer count). {APP}{' '}
          is not affiliated with Twitch and never asks for access to your Twitch account.
        </p>
        <h2>Ads</h2>
        <p>
          When ads are enabled, they are served by Google AdSense. Visitors in the EEA, the UK and Switzerland are asked
          for consent first; without it, only non-personalized ads are shown. You can change your choice at any time from
          the consent link shown by the ad provider.
        </p>
        <h2>Your rights</h2>
        <p>
          Since we can&apos;t link any stored data back to you, there is usually nothing to access or delete. You can still
          contact us, and you can complain to the CNIL (cnil.fr).
        </p>
      </>
    ),
  },
  fr: {
    title: 'Confidentialité',
    body: (
      <>
        <p>
          {APP} n&apos;a pas de comptes. Voici tout ce que nous traitons et pourquoi. Contact pour toute demande :{' '}
          {LEGAL.contactEmail}.
        </p>
        <h2>Ton adresse IP</h2>
        <p>
          Pour permettre un vote toutes les {MIN} minutes par connexion, nous transformons ton adresse IP en code brouillé
          (un hash avec clé) dès que la requête arrive. L&apos;IP brute n&apos;est jamais enregistrée. Le code est gardé en
          mémoire temporaire et expire tout seul : après {MIN} minutes pour les votes, et après une vidéo pour les votes
          de zapping et de signalement. Les adresses IPv6 sont raccourcies à leur préfixe réseau avant le hash.
        </p>
        <h2>Protection anti-robots</h2>
        <p>
          Les votes, zappings et signalements passent par Cloudflare Turnstile, qui vérifie que tu es humain. Cloudflare
          traite pour cela des données techniques sur ton navigateur.
        </p>
        <h2>Ce que nous gardons</h2>
        <p>
          Des données publiques sur les vidéos diffusées (titre, chaîne, durée), le nombre de spectateurs et la façon dont
          elles se sont terminées. Rien de tout cela n&apos;est lié à toi.
        </p>
        <h2>Ton navigateur</h2>
        <p>
          Nous gardons dans le stockage local de ton navigateur une courte liste des vidéos pour lesquelles tu as voté,
          uniquement pour afficher des confettis quand l&apos;une d&apos;elles passe, ainsi qu&apos;un cookie qui retient la
          dernière room visitée. Ni l&apos;un ni l&apos;autre ne sert à autre chose.
        </p>
        <h2>Rooms privées</h2>
        <p>
          Une room privée garde son nom, ses réglages et son mot de passe jusqu&apos;à ce qu&apos;une journée passe sans
          personne devant, ou que son streamer la ferme. Entrer le mot de passe (ou créer la room) dépose un cookie propre
          à cette room, pour ne pas avoir à le retaper ; il dure 7 jours et ne contient aucune donnée personnelle.
        </p>
        <h2>YouTube</h2>
        <p>
          {APP} utilise les services d&apos;API YouTube pour récupérer les informations publiques des vidéos (titre,
          chaîne, durée, vues, catégorie) et pour les lire. En utilisant {APP}, tu acceptes d&apos;être lié par les{' '}
          <Ext href={YT_TERMS}>Conditions d&apos;utilisation de YouTube</Ext>. Les vidéos sont lues dans le lecteur YouTube
          en mode de confidentialité renforcée (youtube-nocookie.com), auquel s&apos;appliquent les{' '}
          <Ext href={GOOGLE_PRIVACY}>Règles de confidentialité de Google</Ext>. {APP} ne demande jamais l&apos;accès à ton
          compte Google ou YouTube.
        </p>
        <h2>Twitch</h2>
        <p>
          La room Twitch diffuse des lives dans le lecteur intégré de Twitch (player.twitch.tv), auquel s&apos;applique
          l&apos;<Ext href={TWITCH_PRIVACY}>Avis de confidentialité de Twitch</Ext>. {APP} utilise l&apos;API Twitch pour
          vérifier qu&apos;une chaîne est en direct et récupérer ses informations publiques (nom, titre du live,
          catégorie, nombre de spectateurs). {APP} n&apos;est pas affilié à Twitch et ne demande jamais l&apos;accès à ton
          compte Twitch.
        </p>
        <h2>Publicité</h2>
        <p>
          Quand la publicité est activée, elle est servie par Google AdSense. Les visiteurs de l&apos;EEE, du Royaume-Uni
          et de Suisse doivent d&apos;abord donner leur consentement ; sans lui, seules des publicités non personnalisées
          sont affichées. Tu peux changer ton choix à tout moment depuis le lien de consentement de la régie.
        </p>
        <h2>Tes droits</h2>
        <p>
          Comme nous ne pouvons relier aucune donnée stockée à toi, il n&apos;y a en général rien à consulter ni à
          supprimer. Tu peux quand même nous contacter, et tu peux saisir la CNIL (cnil.fr).
        </p>
      </>
    ),
  },
  es: {
    title: 'Privacidad',
    body: (
      <>
        <p>
          {APP} no tiene cuentas. Esto es todo lo que tratamos y por qué. Contacto para cualquier solicitud:{' '}
          {LEGAL.contactEmail}.
        </p>
        <h2>Tu dirección IP</h2>
        <p>
          Para permitir un voto cada {MIN} minutos por conexión, convertimos tu dirección IP en un código cifrado (un hash
          con clave) en cuanto llega la petición. La IP original nunca se guarda. El código se mantiene en memoria temporal
          y caduca solo: a los {MIN} minutos para los votos, y tras un vídeo para los votos de saltar y denunciar. Las
          direcciones IPv6 se recortan a su prefijo de red antes del hash.
        </p>
        <h2>Protección contra bots</h2>
        <p>
          Los votos, saltos y denuncias pasan por Cloudflare Turnstile, que comprueba que eres humano. Para ello,
          Cloudflare trata datos técnicos de tu navegador.
        </p>
        <h2>Lo que guardamos</h2>
        <p>
          Datos públicos de los vídeos reproducidos (título, canal, duración), cuántas personas los vieron y cómo
          terminaron. Nada de esto está vinculado a ti.
        </p>
        <h2>Tu navegador</h2>
        <p>
          Guardamos en el almacenamiento local de tu navegador una lista corta de los vídeos que votaste, solo para
          mostrar confeti cuando uno de ellos se reproduce, y una cookie que recuerda la última sala que visitaste. Ninguno
          de los dos se usa para nada más.
        </p>
        <h2>Salas privadas</h2>
        <p>
          Una sala privada guarda su nombre, sus ajustes y su contraseña hasta que pasa un día sin nadie viéndola, o su
          streamer la cierra. Introducir la contraseña (o crear la sala) deja una cookie solo para esa sala, para no tener
          que volver a escribirla; dura 7 días y no contiene datos personales.
        </p>
        <h2>YouTube</h2>
        <p>
          {APP} usa los servicios de API de YouTube para consultar datos públicos de los vídeos (título, canal, duración,
          visualizaciones, categoría) y para reproducirlos. Al usar {APP}, aceptas quedar vinculado por los{' '}
          <Ext href={YT_TERMS}>Términos del servicio de YouTube</Ext>. Los vídeos se reproducen en el reproductor de
          YouTube en modo de privacidad mejorada (youtube-nocookie.com), al que se aplica la{' '}
          <Ext href={GOOGLE_PRIVACY}>Política de privacidad de Google</Ext>. {APP} nunca pide acceso a tu cuenta de Google
          o YouTube.
        </p>
        <h2>Twitch</h2>
        <p>
          La sala Twitch emite directos en el reproductor integrado de Twitch (player.twitch.tv), al que se aplica el{' '}
          <Ext href={TWITCH_PRIVACY}>Aviso de privacidad de Twitch</Ext>. {APP} usa la API de Twitch para comprobar si un
          canal está en directo y obtener sus datos públicos (nombre, título del directo, categoría, número de
          espectadores). {APP} no está afiliado a Twitch y nunca pide acceso a tu cuenta de Twitch.
        </p>
        <h2>Publicidad</h2>
        <p>
          Cuando la publicidad está activada, la sirve Google AdSense. A los visitantes del EEE, el Reino Unido y Suiza se
          les pide primero su consentimiento; sin él, solo se muestran anuncios no personalizados. Puedes cambiar tu
          elección en cualquier momento desde el enlace de consentimiento del proveedor de anuncios.
        </p>
        <h2>Tus derechos</h2>
        <p>
          Como no podemos vincular ningún dato guardado contigo, normalmente no hay nada que consultar ni borrar. Aun así
          puedes contactarnos, y puedes reclamar ante la CNIL (cnil.fr), autoridad francesa de protección de datos.
        </p>
      </>
    ),
  },
  it: {
    title: 'Privacy',
    body: (
      <>
        <p>
          {APP} non ha account. Ecco tutto ciò che trattiamo e perché. Contatto per qualsiasi richiesta:{' '}
          {LEGAL.contactEmail}.
        </p>
        <h2>Il tuo indirizzo IP</h2>
        <p>
          Per consentire un voto ogni {MIN} minuti per connessione, trasformiamo il tuo indirizzo IP in un codice cifrato
          (un hash con chiave) appena arriva la richiesta. L&apos;IP originale non viene mai salvato. Il codice resta in
          memoria temporanea e scade da solo: dopo {MIN} minuti per i voti, e dopo un video per i voti di salto e
          segnalazione. Gli indirizzi IPv6 vengono accorciati al loro prefisso di rete prima dell&apos;hash.
        </p>
        <h2>Protezione dai bot</h2>
        <p>
          Voti, salti e segnalazioni passano da Cloudflare Turnstile, che verifica che tu sia umano. Per farlo, Cloudflare
          tratta dati tecnici del tuo browser.
        </p>
        <h2>Cosa conserviamo</h2>
        <p>
          Dati pubblici sui video trasmessi (titolo, canale, durata), quante persone li hanno guardati e come sono finiti.
          Niente di tutto ciò è collegato a te.
        </p>
        <h2>Il tuo browser</h2>
        <p>
          Conserviamo nella memoria locale del tuo browser un breve elenco dei video per cui hai votato, solo per mostrare
          i coriandoli quando uno di questi va in onda, e un cookie che ricorda l&apos;ultima stanza visitata. Nessuno dei
          due serve ad altro.
        </p>
        <h2>Stanze private</h2>
        <p>
          Una stanza privata conserva nome, impostazioni e password finché non passa un giorno senza nessuno davanti, o il
          suo streamer la chiude. Inserire la password (o creare la stanza) imposta un cookie solo per quella stanza, così
          non devi riscriverla; dura 7 giorni e non contiene dati personali.
        </p>
        <h2>YouTube</h2>
        <p>
          {APP} usa i servizi API di YouTube per recuperare i dati pubblici dei video (titolo, canale, durata,
          visualizzazioni, categoria) e per riprodurli. Usando {APP}, accetti di essere vincolato dai{' '}
          <Ext href={YT_TERMS}>Termini di servizio di YouTube</Ext>. I video vengono riprodotti nel player di YouTube in
          modalità di privacy avanzata (youtube-nocookie.com), a cui si applicano le{' '}
          <Ext href={GOOGLE_PRIVACY}>Norme sulla privacy di Google</Ext>. {APP} non chiede mai l&apos;accesso al tuo
          account Google o YouTube.
        </p>
        <h2>Twitch</h2>
        <p>
          La stanza Twitch trasmette dirette nel player integrato di Twitch (player.twitch.tv), a cui si applica l&apos;
          <Ext href={TWITCH_PRIVACY}>Informativa sulla privacy di Twitch</Ext>. {APP} usa l&apos;API di Twitch per
          verificare se un canale è in diretta e ottenerne i dati pubblici (nome, titolo della diretta, categoria, numero
          di spettatori). {APP} non è affiliato a Twitch e non chiede mai l&apos;accesso al tuo account Twitch.
        </p>
        <h2>Pubblicità</h2>
        <p>
          Quando la pubblicità è attiva, è fornita da Google AdSense. Ai visitatori di SEE, Regno Unito e Svizzera viene
          chiesto prima il consenso; senza consenso vengono mostrati solo annunci non personalizzati. Puoi cambiare la tua
          scelta in qualsiasi momento dal link di consenso del fornitore di annunci.
        </p>
        <h2>I tuoi diritti</h2>
        <p>
          Poiché non possiamo ricollegare a te nessun dato conservato, di solito non c&apos;è nulla da consultare o
          cancellare. Puoi comunque contattarci, e puoi presentare reclamo alla CNIL (cnil.fr), l&apos;autorità francese
          per la protezione dei dati.
        </p>
      </>
    ),
  },
};
