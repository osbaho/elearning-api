import Link from 'next/link';

export default function Home() {
  return (
    <>
      <header className="modern-header">
        <div className="header-inner">
          <Link href="/" className="header-logo">🏥 C-Arm Master</Link>
          <nav className="header-nav" aria-label="Navegación principal">
            <Link href="/" className="active">Inicio</Link>
            <Link href="/course">Curso</Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="hero">
          <div className="container">
            <div className="hero-badge">🌟 Capacitación Técnica Quirúrgica</div>
            <h1>Domina el <span>Arco en C</span> con nuestro curso interactivo</h1>
            <p className="hero-subtitle">
              Aprende fundamentos de radioprotección, operación del equipo y protocolos de seguridad con simuladores y prácticas guiadas para personal médico.
            </p>
            <div className="hero-actions">
              <Link href="/course" className="btn btn-primary">Acceder al Curso</Link>
              <a href="#contact" className="btn btn-secondary">Solicitar Información</a>
            </div>
          </div>
        </section>

        <section className="container section-narrow">
          <h2 className="title-lg text-center">Resumen del Programa</h2>
          <div className="card mb-40">
            <p className="mb-16">
              Este programa integral profundiza en la física aplicada de los rayos X, la cinemática del Arco en C, el posicionamiento anatómico por segmentos y las mejores prácticas en protección radiológica en el quirófano. Consta de 5 módulos estructurados con lecciones audiovisuales, lecturas complementarias y simulaciones interactivas.
            </p>
          </div>

          <h2 className="title-lg text-center">¿Qué competencias desarrollarás?</h2>
          <div className="cards-grid">
            <div className="card">
              <div className="card-icon cyan">🎯</div>
              <h3>Precisión Quirúrgica</h3>
              <p>Aprende a posicionar el equipo de forma rápida, segura y milimétrica, reduciendo significativamente los tiempos de exposición en quirófano.</p>
            </div>
            <div className="card">
              <div className="card-icon green">🛡️</div>
              <h3>Seguridad y Radioprotección</h3>
              <p>Comprende los fundamentos del principio ALARA, el uso de blindajes plomados y los protocolos para minimizar la dispersión radiológica.</p>
            </div>
            <div className="card">
              <div className="card-icon purple">🎮</div>
              <h3>Simulación Práctica</h3>
              <p>Entrena con controles virtuales interactivos de rotación, angulación y colimación para fijar destrezas motoras previas a sala.</p>
            </div>
          </div>
        </section>

        <section id="contact" className="section-contact">
          <div className="container container-narrow mx-auto">
            <h2 className="title-md">¿Deseas implementar el curso en tu institución?</h2>
            <p className="text-secondary mb-32">
              Contáctanos para habilitar credenciales de acceso para tu equipo de cirugía, tecnólogos o residentes.
            </p>
            <div className="flex-center-wrap">
              <a href="mailto:soporte@carm-master.com" className="btn btn-secondary">📧 soporte@carm-master.com</a>
              <Link href="/login" className="btn btn-primary">Ingreso al Portal</Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="modern-footer">
        <div className="footer-inner">
          <p>&copy; 2026 C-Arm Master Training Platform. Para uso educativo únicamente.</p>
          <nav className="footer-links" aria-label="Pie de página">
            <a href="#">Política de Privacidad</a>
            <a href="#">Términos de Uso</a>
            <a href="#">Soporte</a>
          </nav>
        </div>
      </footer>
    </>
  );
}
