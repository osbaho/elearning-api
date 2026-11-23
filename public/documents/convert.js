const { mdToPdf } = require('md-to-pdf');
const path = require('path');
const fs = require('fs');

(async () => {
    try {
        const files = ['lectura_parte1.md', 'lectura_parte2.md', 'lectura_parte3.md', 'lectura_parte4.md', 'lectura_parte5.md', 'guia_rapida_bolsillo.md'];
        const outDir = path.join(__dirname, '..', '..', 'client', 'public', 'documents');
        
        if (!fs.existsSync(outDir)) {
            fs.mkdirSync(outDir, { recursive: true });
        }

        for (const file of files) {
            console.log(`Convirtiendo ${file}...`);
            const outPath = path.join(outDir, file.replace('.md', '.pdf'));
            await mdToPdf({ path: file }, { 
                dest: outPath,
                pdf_options: { format: 'A4', margin: '20mm' },
                launch_options: { args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'] }
            });
            console.log(`✅ Creado: ${outPath}`);
        }
        process.exit(0);
    } catch (e) {
        console.error("Error al convertir:", e);
        process.exit(1);
    }
})();
