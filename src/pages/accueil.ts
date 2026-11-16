export function afficherAccueil(racine: HTMLElement): void {
  racine.innerHTML = `
    <section class="page accueil">
      <h1>Satisfapp</h1>
      <p class="sous-titre">V2 — conduit en profondeur, cire vraie, parois, instruments</p>
      <a class="gros-bouton" href="#jeu">Le bouchon</a>
      <a class="lien-discret" href="#test">Test vibration et son</a>
    </section>`;
}
