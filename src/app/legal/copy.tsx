import Link from 'next/link';
import { APP_NAME as APP, LEGAL } from '@/config/app';

// Mentions légales (LCEN, art. 6), one version per UI language. Every value lives in LEGAL (src/config/app.ts).

const PrivacyLink = ({ children }: { children: React.ReactNode }) => (
  <Link href="/privacy" className="underline underline-offset-2">
    {children}
  </Link>
);

const L = LEGAL;

export const LEGAL_NOTICE: Record<string, { title: string; body: React.ReactNode }> = {
  en: {
    title: 'Legal notice',
    body: (
      <>
        <p className="text-[var(--muted)]">Mentions légales</p>
        <h2>Publisher</h2>
        <p>
          {APP} is published by {L.publisher}, {L.publisherAddress}.
          <br />
          Publication director: {L.publicationDirector}.
          <br />
          Contact: {L.contactEmail}
        </p>
        <h2>Hosting</h2>
        <p>
          {L.host}, {L.hostAddress}, {L.hostWebsite}.
        </p>
        <h2>Content</h2>
        <p>
          Videos are chosen by visitors and played through the YouTube player. They belong to their authors and are
          governed by YouTube&apos;s terms. {APP} is not affiliated with YouTube or Google. To report content, use the
          Report button on screen or write to the contact above.
        </p>
        <p>
          In the Twitch room, live streams are chosen by visitors and played through Twitch&apos;s player. They belong to
          their streamers and are governed by Twitch&apos;s terms. {APP} is not affiliated with Twitch.
        </p>
        <h2>Personal data</h2>
        <p>
          See the <PrivacyLink>privacy page</PrivacyLink>.
        </p>
      </>
    ),
  },
  fr: {
    title: 'Mentions légales',
    body: (
      <>
        <h2>Éditeur</h2>
        <p>
          {APP} est édité par {L.publisher}, {L.publisherAddress}.
          <br />
          Directeur de la publication : {L.publicationDirector}.
          <br />
          Contact : {L.contactEmail}
        </p>
        <h2>Hébergement</h2>
        <p>
          {L.host}, {L.hostAddress}, {L.hostWebsite}.
        </p>
        <h2>Contenus</h2>
        <p>
          Les vidéos sont choisies par les visiteurs et lues dans le lecteur YouTube. Elles appartiennent à leurs auteurs et
          relèvent des conditions de YouTube. {APP} n&apos;est pas affilié à YouTube ni à Google. Pour signaler un contenu,
          utilise le bouton Signaler à l&apos;écran ou écris au contact ci-dessus.
        </p>
        <p>
          Dans la room Twitch, les lives sont choisis par les visiteurs et lus dans le lecteur de Twitch. Ils appartiennent
          à leurs streamers et relèvent des conditions de Twitch. {APP} n&apos;est pas affilié à Twitch.
        </p>
        <h2>Données personnelles</h2>
        <p>
          Voir la <PrivacyLink>page confidentialité</PrivacyLink>.
        </p>
      </>
    ),
  },
  es: {
    title: 'Aviso legal',
    body: (
      <>
        <p className="text-[var(--muted)]">Mentions légales</p>
        <h2>Editor</h2>
        <p>
          {APP} es editado por {L.publisher}, {L.publisherAddress}.
          <br />
          Director de la publicación: {L.publicationDirector}.
          <br />
          Contacto: {L.contactEmail}
        </p>
        <h2>Alojamiento</h2>
        <p>
          {L.host}, {L.hostAddress}, {L.hostWebsite}.
        </p>
        <h2>Contenidos</h2>
        <p>
          Los vídeos los eligen los visitantes y se reproducen en el reproductor de YouTube. Pertenecen a sus autores y se
          rigen por las condiciones de YouTube. {APP} no está afiliado a YouTube ni a Google. Para denunciar un contenido,
          usa el botón Denunciar en pantalla o escribe al contacto de arriba.
        </p>
        <p>
          En la sala Twitch, los directos los eligen los visitantes y se reproducen en el reproductor de Twitch.
          Pertenecen a sus streamers y se rigen por las condiciones de Twitch. {APP} no está afiliado a Twitch.
        </p>
        <h2>Datos personales</h2>
        <p>
          Consulta la <PrivacyLink>página de privacidad</PrivacyLink>.
        </p>
      </>
    ),
  },
  it: {
    title: 'Note legali',
    body: (
      <>
        <p className="text-[var(--muted)]">Mentions légales</p>
        <h2>Editore</h2>
        <p>
          {APP} è pubblicato da {L.publisher}, {L.publisherAddress}.
          <br />
          Direttore della pubblicazione: {L.publicationDirector}.
          <br />
          Contatto: {L.contactEmail}
        </p>
        <h2>Hosting</h2>
        <p>
          {L.host}, {L.hostAddress}, {L.hostWebsite}.
        </p>
        <h2>Contenuti</h2>
        <p>
          I video sono scelti dai visitatori e riprodotti nel player di YouTube. Appartengono ai loro autori e sono
          regolati dai termini di YouTube. {APP} non è affiliato a YouTube né a Google. Per segnalare un contenuto, usa il
          pulsante Segnala sullo schermo o scrivi al contatto qui sopra.
        </p>
        <p>
          Nella stanza Twitch, le dirette sono scelte dai visitatori e riprodotte nel player di Twitch. Appartengono ai
          loro streamer e sono regolate dai termini di Twitch. {APP} non è affiliato a Twitch.
        </p>
        <h2>Dati personali</h2>
        <p>
          Vedi la <PrivacyLink>pagina sulla privacy</PrivacyLink>.
        </p>
      </>
    ),
  },
};
