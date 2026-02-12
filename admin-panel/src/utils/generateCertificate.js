import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

/**
 * Gera um Certificado de Veiculação em PDF
 * Comprovante oficial de que os anúncios foram exibidos (Proof of Play)
 */
export function generateCertificate({ logs, terminals, userName, dateRange, stats }) {
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    const contentWidth = pageWidth - margin * 2;

    // Gerar código de verificação único
    const certCode = `CVL-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
    const emissionDate = new Date().toLocaleDateString('pt-BR', {
        day: '2-digit', month: 'long', year: 'numeric'
    });

    // Formatar período
    const formatPeriod = () => {
        const labels = {
            today: 'Hoje',
            yesterday: 'Ontem',
            week: 'Últimos 7 dias',
            month: 'Últimos 30 dias'
        };
        return labels[dateRange] || dateRange;
    };

    // ─── CORES ───
    const BLUE = [37, 99, 235];       // #2563EB
    const DARK = [15, 23, 42];        // #0F172A
    const GRAY = [100, 116, 139];     // #64748B
    const LIGHT = [241, 245, 249];    // #F1F5F9
    const WHITE = [255, 255, 255];

    let y = 0;

    // ═══════════════════════════════════════════════
    // HEADER — Faixa azul com título
    // ═══════════════════════════════════════════════
    doc.setFillColor(...BLUE);
    doc.rect(0, 0, pageWidth, 45, 'F');

    // Logo text
    doc.setTextColor(...WHITE);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('CONECTA LOCAL', margin, 15);

    // Título
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('CERTIFICADO DE VEICULAÇÃO', margin, 28);

    // Subtítulo
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('Proof of Play — Comprovante Oficial de Exibição', margin, 36);

    // Código no canto
    doc.setFontSize(8);
    doc.text(certCode, pageWidth - margin, 15, { align: 'right' });
    doc.text(`Emitido em ${emissionDate}`, pageWidth - margin, 22, { align: 'right' });

    y = 55;

    // ═══════════════════════════════════════════════
    // DADOS DO ANUNCIANTE
    // ═══════════════════════════════════════════════
    doc.setFillColor(...LIGHT);
    doc.roundedRect(margin, y, contentWidth, 28, 3, 3, 'F');

    doc.setTextColor(...DARK);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('DADOS DO ANUNCIANTE', margin + 6, y + 8);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...GRAY);
    doc.setFontSize(9);
    doc.text(`Anunciante: ${userName || 'N/A'}`, margin + 6, y + 16);
    doc.text(`Período: ${formatPeriod()}`, margin + 6, y + 23);

    y += 36;

    // ═══════════════════════════════════════════════
    // RESUMO DE VEICULAÇÃO (cards em linha)
    // ═══════════════════════════════════════════════
    doc.setTextColor(...DARK);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('RESUMO DE VEICULAÇÃO', margin, y);
    y += 6;

    const cardWidth = (contentWidth - 8) / 3;
    const cards = [
        { label: 'Total de Exibições', value: stats.total.toLocaleString('pt-BR') },
        { label: 'Mídias Únicas', value: String(stats.uniqueMedia) },
        { label: 'Telas Ativas', value: String(terminals.length) }
    ];

    cards.forEach((card, i) => {
        const cx = margin + i * (cardWidth + 4);
        doc.setFillColor(...BLUE);
        doc.roundedRect(cx, y, cardWidth, 22, 3, 3, 'F');

        doc.setTextColor(200, 210, 255);
        doc.setFontSize(7);
        doc.setFont('helvetica', 'bold');
        doc.text(card.label.toUpperCase(), cx + 6, y + 8);

        doc.setTextColor(...WHITE);
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text(card.value, cx + 6, y + 18);
    });

    y += 30;

    // ═══════════════════════════════════════════════
    // DETALHAMENTO POR TERMINAL
    // ═══════════════════════════════════════════════
    doc.setTextColor(...DARK);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('DETALHAMENTO POR TERMINAL', margin, y);
    y += 4;

    // Agrupar logs por terminal
    const terminalStats = {};
    logs.forEach(log => {
        const tid = log.terminal_id;
        if (!terminalStats[tid]) {
            terminalStats[tid] = {
                name: log.terminals?.name || 'N/A',
                location: log.terminals?.location || 'N/A',
                count: 0,
                firstPlay: log.played_at,
                lastPlay: log.played_at
            };
        }
        terminalStats[tid].count++;
        if (log.played_at < terminalStats[tid].firstPlay) terminalStats[tid].firstPlay = log.played_at;
        if (log.played_at > terminalStats[tid].lastPlay) terminalStats[tid].lastPlay = log.played_at;
    });

    const terminalRows = Object.values(terminalStats)
        .sort((a, b) => b.count - a.count)
        .map(t => [
            t.name,
            t.location,
            t.count.toLocaleString('pt-BR'),
            new Date(t.firstPlay).toLocaleDateString('pt-BR'),
            new Date(t.lastPlay).toLocaleDateString('pt-BR')
        ]);

    autoTable(doc, {
        startY: y,
        head: [['Terminal', 'Local', 'Exibições', 'Primeira', 'Última']],
        body: terminalRows.length > 0 ? terminalRows : [['Sem dados', '-', '0', '-', '-']],
        margin: { left: margin, right: margin },
        styles: {
            fontSize: 8,
            cellPadding: 4,
            lineColor: [226, 232, 240],
            lineWidth: 0.5,
        },
        headStyles: {
            fillColor: DARK,
            textColor: WHITE,
            fontStyle: 'bold',
            fontSize: 7,
        },
        alternateRowStyles: {
            fillColor: [248, 250, 252],
        },
        columnStyles: {
            2: { halign: 'center', fontStyle: 'bold' },
            3: { halign: 'center' },
            4: { halign: 'center' },
        },
    });

    y = doc.lastAutoTable.finalY + 8;

    // ═══════════════════════════════════════════════
    // TOP 10 MÍDIAS
    // ═══════════════════════════════════════════════
    // Check if we need a new page
    if (y > 220) {
        doc.addPage();
        y = 20;
    }

    doc.setTextColor(...DARK);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('TOP MÍDIAS MAIS EXIBIDAS', margin, y);
    y += 4;

    const mediaStats = {};
    logs.forEach(log => {
        const name = log.media_name || 'Desconhecido';
        if (!mediaStats[name]) mediaStats[name] = { count: 0, type: log.slot_type };
        mediaStats[name].count++;
    });

    const mediaRows = Object.entries(mediaStats)
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 10)
        .map(([name, data], i) => [
            `${i + 1}°`,
            name,
            data.type || 'N/A',
            data.count.toLocaleString('pt-BR'),
            `${((data.count / stats.total) * 100).toFixed(1)}%`
        ]);

    autoTable(doc, {
        startY: y,
        head: [['#', 'Mídia', 'Tipo', 'Exibições', '% do Total']],
        body: mediaRows.length > 0 ? mediaRows : [['—', 'Sem dados', '-', '0', '0%']],
        margin: { left: margin, right: margin },
        styles: {
            fontSize: 8,
            cellPadding: 4,
            lineColor: [226, 232, 240],
            lineWidth: 0.5,
        },
        headStyles: {
            fillColor: DARK,
            textColor: WHITE,
            fontStyle: 'bold',
            fontSize: 7,
        },
        alternateRowStyles: {
            fillColor: [248, 250, 252],
        },
        columnStyles: {
            0: { halign: 'center', cellWidth: 12, fontStyle: 'bold' },
            1: { cellWidth: 70 },
            3: { halign: 'center', fontStyle: 'bold' },
            4: { halign: 'center' },
        },
    });

    y = doc.lastAutoTable.finalY + 12;

    // ═══════════════════════════════════════════════
    // FOOTER — Disclaimer + código de verificação
    // ═══════════════════════════════════════════════
    if (y > 250) {
        doc.addPage();
        y = 20;
    }

    // Linha separadora
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageWidth - margin, y);
    y += 8;

    doc.setTextColor(...GRAY);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');

    const disclaimer = [
        'Este documento é um certificado de veiculação gerado automaticamente pela plataforma Conecta Local.',
        'Os dados apresentados refletem as exibições registradas pelos terminais durante o período informado.',
        'Para verificar a autenticidade deste documento, utilize o código de verificação abaixo.',
    ];

    disclaimer.forEach((line, i) => {
        doc.text(line, margin, y + (i * 4));
    });

    y += 18;

    // Box com código de verificação
    doc.setFillColor(...LIGHT);
    doc.roundedRect(margin, y, contentWidth, 14, 3, 3, 'F');

    doc.setTextColor(...DARK);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text(`Código de Verificação: ${certCode}`, margin + 6, y + 6);

    doc.setTextColor(...GRAY);
    doc.setFont('helvetica', 'normal');
    doc.text(`Data de emissão: ${emissionDate}`, margin + 6, y + 11);

    doc.setTextColor(...BLUE);
    doc.text('conectalocal.com.br', pageWidth - margin - 6, y + 9, { align: 'right' });

    // ─── SALVAR ───
    const fileName = `certificado_veiculacao_${dateRange}_${new Date().toISOString().slice(0, 10)}.pdf`;
    doc.save(fileName);

    return { certCode, fileName };
}
