/*
 * Avatar animé : bande de 6 frames idle (Petdex) qui défile en CSS
 * steps(6) via .anim-sprite. Dimensionner avec une hauteur (h-*) :
 * aspect-[192/208] donne la largeur. `delay` négatif désynchronise
 * les personnages entre eux.
 */
export function SpriteAvatar({
  src,
  alt,
  className = "",
  delay = 0,
}: {
  src: string;
  alt: string;
  className?: string;
  delay?: number;
}) {
  return (
    <span
      role="img"
      aria-label={alt}
      className={`anim-sprite aspect-[192/208] bg-no-repeat [background-size:600%_100%] ${className}`}
      style={
        {
          backgroundImage: `url(${src})`,
          "--delay": `${delay}s`,
        } as React.CSSProperties
      }
    />
  );
}
