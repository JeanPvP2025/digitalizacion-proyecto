export type DemoReviewSample = {
  rating: 4 | 5;
  title: string;
  body: string;
};

/** Fictional presentation copy; never mixed into the verified customer review table. */
export const demoReviewSamples: readonly DemoReviewSample[] = [
  {
    rating: 5,
    title: "Ficha clara y fácil de comparar",
    body: "El resumen y las especificaciones ayudan a revisar el modelo antes de añadirlo al carrito. Este texto de ejemplo no corresponde a una compra real.",
  },
  {
    rating: 4,
    title: "Una selección bien organizada",
    body: "La información técnica se entiende de un vistazo y el configurador facilita comparar componentes compatibles. Opinión ficticia para mostrar la experiencia de la tienda.",
  },
];
