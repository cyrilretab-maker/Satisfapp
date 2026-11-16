export function afficherAccueil(racine: HTMLElement): void {
  racine.innerHTML = `
    <section class="page accueil">
      <h1>Satisfapp</h1>
      <p class="sous-titre">Socle technique — lot 0</p>
      <a class="gros-bouton" href="#test">Test vibration et son</a>
    </section>`;
}
