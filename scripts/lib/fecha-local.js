// fecha-local.js - la fecha de HOY como la ve el dueño, no como la ve UTC.
//
// Por que existe: `new Date().toISOString().slice(0, 10)` devuelve la fecha en **UTC**. Aca el
// reloj esta en -03:00, asi que a partir de las 21:00 locales el ISO ya dice el dia siguiente.
//
// Medido el 10/09/2026 a las 21:56: `cierre` reclamaba una entrada de bitacora del 2026-09-11
// -un dia que todavia no habia empezado- mientras el commit que se acababa de hacer estaba
// fechado 2026-09-10, porque git usa hora local. El gate pedia algo imposible de cumplir sin
// mentir sobre cuando paso el trabajo.
//
// Todo lo que se compare con `git log`, con una entrada de bitacora o con un sello de
// `metrics/tool-runs.log` tiene que usar esto: esas tres cosas se escriben en hora LOCAL.

// `AAAA-MM-DD` local. Se arma a mano en vez de con toISOString() justamente para no pasar por UTC.
function hoy(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

// `AAAA-MM-DD` local de hace N dias. Para ventanas del tipo "los ultimos 7 dias".
function haceDias(n, d = new Date()) {
  return hoy(new Date(d.getTime() - n * 864e5))
}

module.exports = { hoy, haceDias }
