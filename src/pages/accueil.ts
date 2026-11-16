export function afficherAccueil(racine: HTMLElement): void {
  racine.innerHTML = `
    <section class="page accueil">
      <h1>Satisfapp</h1>
      <p class="sous-titre">Lots 3 à 5 — tension, habillage, bocal</p>
      <a class="gros-bouton" href="#jeu">Le bouchon</a>
      <a class="lien-discret" href="#test">Test vibration et son</a>
    </section>`;
}
