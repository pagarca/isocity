# Isocity · Cibeles

Mapa isométrico dimétrico 2:1, en estilo pixel art, del entorno de la plaza de Cibeles (Madrid),
construido solo con fuentes abiertas y públicas.

**Visor (Cibeles y Prado, un solo mapa):** https://pagarca.github.io/isocity/
**Cada tesela por separado:** https://pagarca.github.io/isocity/cibeles/ · https://pagarca.github.io/isocity/prado/

Se arrastra para moverse, la rueda o el pellizco amplían, y al pasar el cursor sobre un edificio aparece
su identificador municipal `ID_3D`.

Este repositorio contiene únicamente el sitio ya generado (`docs/`): un visor estático y la imagen
prerenderizada del mapa. No incluye el generador ni los datos de partida.

## Licencia

- El **código del visor** (`docs/index.html` y `docs/viewer.js`) se publica bajo licencia [MIT](LICENSE).
- La **imagen del mapa** (`docs/map.js`) es una obra derivada de datos abiertos de terceros y **cada
  fuente conserva sus propias condiciones**; la licencia MIT de este repositorio no las sustituye. Las
  atribuciones también se muestran en el pie del visor.

## Fuentes y atribuciones

| Contenido | Fuente | Condiciones |
| --- | --- | --- |
| Edificios, alturas, viario, arbolado, parques, agua, ortofoto, mobiliario urbano y vuelo oblicuo 2024 | © Ayuntamiento de Madrid. Datos abiertos del Geoportal de Madrid | [Condiciones generales](https://datos.madrid.es/pages/condiciones-generales-ayuntamiento-de-madrid) |
| Modelo LOD2 de algunos edificios | Ayuntamiento de Madrid | Condiciones generales de datos abiertos |
| Monumentos | Inventario Monumenta, Ayuntamiento de Madrid | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |
| Paradas de autobús | EMT Madrid (GTFS) | ODC-By 1.0 |
| Accesos de Metro | Consorcio Regional de Transportes de Madrid (datos elaborados) | [Licencia de uso CRTM](https://www.crtm.es/licencia-de-uso) |
| Relieve | Instituto Geográfico Nacional, Modelo Nacional del Terreno (5 m) | CC BY 4.0 scne.es |
| Una fachada del Palacio de Cibeles | Fotografía de Nicolas Vigier, Wikimedia Commons | CC0 1.0 |

Las fachadas se obtienen proyectando fotografías del vuelo oblicuo 2024 del Ayuntamiento de Madrid sobre
los volúmenes de los edificios y reduciéndolas a una paleta de pocos colores. Las alturas de edificio
sin dato municipal se estiman, y las cubiertas inclinadas y los detalles de fachada son procedimentales:
es una representación estilizada, no una réplica fiel.
