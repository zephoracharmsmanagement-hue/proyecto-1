/* Microsoft Clarity · proyecto «Zephora Charms» (zg8e6n5pyk), 2026-11-19.
 *
 * Grabaciones de sesión y mapas de calor, para ver dónde se traban las
 * clientas (pedido del propietario: «me gustaria que usaramos el clarity»).
 *
 * Va aparte de todo lo demás a propósito: no toca el píxel de Meta, ni la
 * CAPI, ni el cobro. Si clarity.ms no responde, no pasa nada en la tienda.
 *
 * Diferido dos veces: el <script> lleva `defer` y, además, la etiqueta de
 * Clarity se pide recién cuando la página terminó de cargar y el navegador
 * está libre. Así no compite con las fotos, el carrito ni el checkout.
 *
 * Datos personales: lo que se teclea en los campos Clarity lo oculta solo,
 * pero el texto que la página pinta no. Por eso los bloques con nombre,
 * celular, correo, dirección o datos del pedido llevan
 * data-clarity-mask="true" (checkout, gracias, reseñas, suscripción), y
 * pruebas/clarity.js lo exige.
 */
(function () {
  var ID = 'zg8e6n5pyk';
  if (window.clarity) return;
  function cargar() {
    (function (c, l, a, r, i, t, y) {
      c[a] = c[a] || function () { (c[a].q = c[a].q || []).push(arguments); };
      t = l.createElement(r); t.async = 1; t.src = 'https://www.clarity.ms/tag/' + i;
      y = l.getElementsByTagName(r)[0]; y.parentNode.insertBefore(t, y);
    })(window, document, 'clarity', 'script', ID);
  }
  function cuandoLibre() {
    if ('requestIdleCallback' in window) requestIdleCallback(cargar, { timeout: 4000 });
    else setTimeout(cargar, 1500);
  }
  if (document.readyState === 'complete') cuandoLibre();
  else window.addEventListener('load', cuandoLibre, { once: true });
})();
