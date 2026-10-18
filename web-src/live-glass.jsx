/* global React */
const { useId, useMemo } = React;

/* ============================================================
   Beer3D — multi-layer SVG glass with 3/4 perspective,
   refraction highlights, animated foam + bubbles.
   ============================================================ */
function Beer3D({
  fillPct = 100,
  width = 260,
  height = 420,
  beer = '#F5A623',
  beerDeep = '#7E3A05',
  beerLight = '#FFD56B',
  foam = '#FFF8E3',
  shadow = true,
  bubbles = true,
  rotate = 0,         // degrees Y rotation (CSS3D)
  perspective = 1200, // CSS px
  className = '',
}) {
  const id = useId().replace(/:/g, '');
  const fill = Math.max(0, Math.min(100, fillPct));
  const lite = typeof window !== 'undefined' && !!window.BEERTAP_LITE;

  // glass geometry (in 200×320 coords) — slightly cone-shaped (pint)
  const W = 200, H = 320;
  const topY = 32, botY = 296;
  // top-rim half-width, bottom half-width — cone taper
  const topHW = 72, botHW = 58;
  const cxs = W / 2;
  // perspective: top rim seen at an angle → flatter ellipse
  const rimRyTop = 9;
  const rimRyBot = 6;

  // beer surface y at fill %
  const surfaceY = topY + (botY - topY) * (1 - fill / 100);
  // surface ellipse rx depends on cone position
  const t = (surfaceY - topY) / (botY - topY);
  const surfaceHW = topHW + (botHW - topHW) * t;

  // glass path (front face — tilted shape, top rim arc, sides, bottom)
  const glassPath = `
    M ${cxs - topHW} ${topY}
    A ${topHW} ${rimRyTop} 0 0 0 ${cxs + topHW} ${topY}
    L ${cxs + botHW} ${botY}
    A ${botHW} ${rimRyBot} 0 0 1 ${cxs - botHW} ${botY}
    Z
  `;
  const topRimPath = `M ${cxs - topHW} ${topY} A ${topHW} ${rimRyTop} 0 0 1 ${cxs + topHW} ${topY} A ${topHW} ${rimRyTop} 0 0 1 ${cxs - topHW} ${topY} Z`;

  return (
    <div
      className={className}
      style={{
        perspective: perspective + 'px',
        display: 'inline-block',
        filter: shadow && !lite ? 'drop-shadow(0 30px 32px rgba(0,0,0,0.55))' : 'none',
      }}>
      <svg
        width={width}
        height={height + (shadow ? 24 : 0)}
        viewBox={`0 0 ${W} ${H + 24}`}
        style={{
          overflow: 'visible',
          transform: `rotateY(${rotate}deg)`,
          transformStyle: 'preserve-3d',
          transition: 'transform 800ms cubic-bezier(.2,.8,.2,1)',
        }}>
        <defs>
          {/* Beer body gradient — saturated bottom, bright top */}
          <linearGradient id={`g-beer-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"  stopColor={beerLight}/>
            <stop offset="35%" stopColor={beer}/>
            <stop offset="100%" stopColor={beerDeep}/>
          </linearGradient>
          {/* Beer body gradient on x for refraction */}
          <linearGradient id={`g-beer-x-${id}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%"  stopColor="rgba(255,255,255,0)"/>
            <stop offset="6%"  stopColor="rgba(255,255,255,0.32)"/>
            <stop offset="14%" stopColor="rgba(255,255,255,0)"/>
            <stop offset="86%" stopColor="rgba(255,255,255,0)"/>
            <stop offset="93%" stopColor="rgba(255,224,150,0.22)"/>
            <stop offset="100%" stopColor="rgba(255,255,255,0)"/>
          </linearGradient>
          {/* Glass shell — edge highlights */}
          <linearGradient id={`g-glass-${id}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%"  stopColor="rgba(255,255,255,0.55)"/>
            <stop offset="6%"  stopColor="rgba(255,255,255,0.08)"/>
            <stop offset="50%" stopColor="rgba(255,255,255,0.0)"/>
            <stop offset="94%" stopColor="rgba(255,255,255,0.1)"/>
            <stop offset="100%" stopColor="rgba(255,255,255,0.45)"/>
          </linearGradient>
          {/* Foam radial */}
          <radialGradient id={`g-foam-${id}`} cx="50%" cy="35%" r="55%">
            <stop offset="0%"  stopColor="#FFFFFF"/>
            <stop offset="60%" stopColor={foam}/>
            <stop offset="100%" stopColor="#D8C18E"/>
          </radialGradient>
          {/* Rim shadow */}
          <linearGradient id={`g-rim-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"  stopColor="rgba(0,0,0,0.55)"/>
            <stop offset="100%" stopColor="rgba(0,0,0,0)"/>
          </linearGradient>
          {/* Foam top — slight shadow under the rim from above */}
          <radialGradient id={`g-foam-top-${id}`} cx="50%" cy="50%" r="55%">
            <stop offset="0%"  stopColor="#FFFFFF"/>
            <stop offset="100%" stopColor="#D8C18E"/>
          </radialGradient>

          {/* Soft blur for foam edges */}
          <filter id={`f-soft-${id}`}>
            <feGaussianBlur stdDeviation={lite ? 0 : 1.1}/>
          </filter>

          {/* Glass clip — for surface contents */}
          <clipPath id={`c-glass-${id}`}>
            <path d={glassPath}/>
          </clipPath>

          {/* The inside-of-glass shadow */}
          <radialGradient id={`g-inside-${id}`} cx="50%" cy="50%" r="60%">
            <stop offset="0%"  stopColor="rgba(0,0,0,0)"/>
            <stop offset="100%" stopColor="rgba(0,0,0,0.45)"/>
          </radialGradient>
        </defs>

        {/* Floor shadow ellipse */}
        {shadow && (
          <ellipse cx={cxs} cy={H + 12} rx={botHW + 6} ry={5}
            fill="rgba(0,0,0,0.5)" filter={`url(#f-soft-${id})`}/>
        )}

        {/* Glass body backdrop — slight tint */}
        <path d={glassPath} fill="rgba(255,255,255,0.02)" stroke="none"/>

        {/* Inside contents, clipped */}
        <g clipPath={`url(#c-glass-${id})`}>
          {/* Beer body */}
          {fill > 0 && (
            <>
              <rect
                x={0}
                y={surfaceY}
                width={W}
                height={botY - surfaceY + 30}
                fill={`url(#g-beer-${id})`}
              />
              {/* x-refraction highlights overlay on beer */}
              <rect
                x={0}
                y={surfaceY}
                width={W}
                height={botY - surfaceY + 30}
                fill={`url(#g-beer-x-${id})`}
              />
              {/* surface meniscus shimmer */}
              <ellipse
                cx={cxs}
                cy={surfaceY + 2}
                rx={surfaceHW - 2}
                ry={4}
                fill="rgba(255,220,140,0.45)"
                style={{ animation: 'shimmerY 2.8s ease-in-out infinite' }}
              />
              {/* darker bottom-of-beer for depth */}
              <ellipse
                cx={cxs}
                cy={botY - 4}
                rx={botHW - 6}
                ry={5}
                fill="rgba(0,0,0,0.4)"
              />
            </>
          )}

          {/* Bubbles rising */}
          {bubbles && fill > 10 && (
            <g fill="rgba(255,255,255,0.6)">
              {Array.from({ length: lite ? 5 : 12 }).map((_, i) => {
                const x = cxs - botHW + 8 + (i * 11) % ((botHW - 8) * 2);
                const dur = 2.4 + (i % 5) * 0.45;
                return (
                  <circle
                    key={i}
                    cx={x}
                    cy={botY - 8}
                    r={1.4 + (i % 3) * 0.7}
                    style={{
                      animation: `bubbleUp ${dur}s ease-in ${i * 0.22}s infinite`,
                      transformBox: 'fill-box',
                      transformOrigin: 'center',
                    }}/>
                );
              })}
            </g>
          )}

          {/* Foam head — under-side from inside */}
          {fill > 6 && (
            <g filter={`url(#f-soft-${id})`}>
              <ellipse cx={cxs - 18} cy={surfaceY - 6}  rx={28} ry={14} fill={`url(#g-foam-${id})`}/>
              <ellipse cx={cxs + 14} cy={surfaceY - 10} rx={32} ry={16} fill={`url(#g-foam-${id})`}/>
              <ellipse cx={cxs}      cy={surfaceY - 18} rx={36} ry={18} fill={`url(#g-foam-${id})`}/>
              <ellipse cx={cxs - 28} cy={surfaceY - 22} rx={18} ry={11} fill={`url(#g-foam-${id})`}/>
              <ellipse cx={cxs + 26} cy={surfaceY - 21} rx={20} ry={12} fill={`url(#g-foam-${id})`}/>
              <ellipse cx={cxs - 8}  cy={surfaceY - 28} rx={14} ry={9}  fill={`url(#g-foam-${id})`}/>
              <ellipse cx={cxs + 16} cy={surfaceY - 30} rx={12} ry={8}  fill={`url(#g-foam-${id})`}/>
            </g>
          )}

          {/* Inside shadow vignette for depth */}
          <path d={glassPath} fill={`url(#g-inside-${id})`} opacity="0.6"/>
        </g>

        {/* Top rim of foam — overhang above top of glass */}
        {fill > 80 && (
          <g filter={`url(#f-soft-${id})`}>
            <ellipse cx={cxs - 18} cy={topY - 4}  rx={20} ry={9}  fill={`url(#g-foam-top-${id})`}/>
            <ellipse cx={cxs + 16} cy={topY - 6}  rx={22} ry={10} fill={`url(#g-foam-top-${id})`}/>
            <ellipse cx={cxs}      cy={topY - 12} rx={28} ry={11} fill={`url(#g-foam-top-${id})`}/>
            <ellipse cx={cxs - 26} cy={topY - 14} rx={14} ry={7}  fill={`url(#g-foam-top-${id})`}/>
            <ellipse cx={cxs + 24} cy={topY - 13} rx={14} ry={7}  fill={`url(#g-foam-top-${id})`}/>
            <ellipse cx={cxs + 4}  cy={topY - 22} rx={18} ry={8}  fill="#FFFFFF"/>
          </g>
        )}

        {/* Glass outline + edge highlight */}
        <path d={glassPath} fill={`url(#g-glass-${id})`} stroke="rgba(255,255,255,0.7)" strokeWidth="1.4"/>

        {/* Top rim ellipse (front half) — visible because we're slightly above */}
        <path
          d={`M ${cxs - topHW} ${topY} A ${topHW} ${rimRyTop} 0 0 0 ${cxs + topHW} ${topY}`}
          fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="1.4"
        />
        {/* Top rim back half (shaded — behind foam) */}
        <path
          d={`M ${cxs - topHW} ${topY} A ${topHW} ${rimRyTop} 0 0 1 ${cxs + topHW} ${topY}`}
          fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="1" strokeDasharray="2 2"
        />

        {/* Long vertical specular highlight (left side) */}
        <path
          d={`M ${cxs - topHW + 6} ${topY + 14} Q ${cxs - topHW + 14} ${H / 2} ${cxs - botHW + 8} ${botY - 10}`}
          fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="3" strokeLinecap="round"
          filter={`url(#f-soft-${id})`}
        />
        {/* thin sharp glint */}
        <path
          d={`M ${cxs - topHW + 10} ${topY + 18} Q ${cxs - topHW + 18} ${H / 2} ${cxs - botHW + 12} ${botY - 14}`}
          fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="1.2" strokeLinecap="round"
        />
        {/* right edge subtle highlight */}
        <path
          d={`M ${cxs + topHW - 8} ${topY + 14} Q ${cxs + topHW - 18} ${H / 2} ${cxs + botHW - 8} ${botY - 14}`}
          fill="none" stroke="rgba(255,255,255,0.32)" strokeWidth="2" strokeLinecap="round"
          filter={`url(#f-soft-${id})`}
        />

        {/* Subtle inside-rim shadow */}
        <path
          d={`M ${cxs - topHW + 1} ${topY + 1} A ${topHW - 1} ${rimRyTop - 1} 0 0 0 ${cxs + topHW - 1} ${topY + 1}`}
          fill={`url(#g-rim-${id})`} opacity="0.6"
        />
      </svg>
    </div>
  );
}

/* Mini variant — small Beer3D for use in lists/cards */
function Beer3DMini({ size = 56, beer = '#F5A623', beerDeep = '#7E3A05', fillPct = 92 }) {
  return <Beer3D width={size} height={size * 1.5} fillPct={fillPct} beer={beer} beerDeep={beerDeep} bubbles={false} shadow={false}/>;
}

Object.assign(window, { Beer3D, Beer3DMini });
