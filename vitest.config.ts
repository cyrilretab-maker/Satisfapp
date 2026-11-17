import { defineConfig } from 'vitest/config';

// Les tests de l'eau simulent des parties entières : sur le serveur de GitHub (plus lent),
// ils peuvent dépasser les 5 secondes accordées par défaut.
export default defineConfig({
  test: {
    testTimeout: 60000,
  },
});
