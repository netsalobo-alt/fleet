import React, { useState } from 'react';
import {
  X,
  FileText,
  Image as ImageIcon,
  Download,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Maximize2,
  ExternalLink,
  Printer,
  Calendar,
  DollarSign,
  Car,
  Store,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';
import { ServiceLog } from '../types';
import { LicensePlateBadge } from './LicensePlateBadge';

interface InvoiceDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  service: ServiceLog | null;
}

export const InvoiceDocumentModal: React.FC<InvoiceDocumentModalProps> = ({
  isOpen,
  onClose,
  service,
}) => {
  const [zoomLevel, setZoomLevel] = useState(1);
  const [rotation, setRotation] = useState(0);

  if (!isOpen || !service || !service.anexoDocumento) return null;

  const doc = service.anexoDocumento;
  const isImage = doc.tipo === 'IMAGEM' || doc.nome.match(/\.(jpeg|jpg|png|webp|svg)$/i);
  const isPdf = doc.tipo === 'PDF' || doc.nome.toLowerCase().endsWith('.pdf');

  const handleZoomIn = () => setZoomLevel(prev => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setZoomLevel(prev => Math.max(prev - 0.25, 0.5));
  const handleResetZoom = () => {
    setZoomLevel(1);
    setRotation(0);
  };
  const handleRotate = () => setRotation(prev => (prev + 90) % 360);

  const handleDownload = () => {
    if (!doc.urlBase64) {
      alert('Arquivo não disponível para download direto.');
      return;
    }
    const a = document.createElement('a');
    a.href = doc.urlBase64;
    a.download = doc.nome || `Nota_Fiscal_${service.placa}_${service.data}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    if (isImage && doc.urlBase64) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Nota Fiscal / Ordem de Serviço - ${service.placa}</title>
            <style>
              body { font-family: sans-serif; text-align: center; margin: 20px; }
              img { max-width: 100%; height: auto; border: 1px solid #ccc; }
              .header { margin-bottom: 20px; text-align: left; }
            </style>
          </head>
          <body>
            <div class="header">
              <h2>Fleet Frota PA - Documento de Manutenção</h2>
              <p><strong>Veículo:</strong> ${service.modelo} (${service.placa}) | <strong>Data:</strong> ${service.data.split('-').reverse().join('/')}</p>
              <p><strong>Fornecedor:</strong> ${service.fornecedor} | <strong>Total:</strong> R$ ${service.valorTotal.toFixed(2)}</p>
            </div>
            <img src="${doc.urlBase64}" alt="Nota Fiscal" />
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => printWindow.print(), 500);
    } else {
      handleDownload();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[95vh] flex flex-col overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="p-4 bg-gradient-to-r from-[#0F2744] via-[#16365C] to-[#1E3A5F] text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/20 shrink-0">
              {isPdf ? (
                <FileText className="w-5 h-5 text-red-400" />
              ) : (
                <ImageIcon className="w-5 h-5 text-sky-400" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-sm sm:text-base text-white truncate">
                  {doc.nome || 'Nota Fiscal / Ordem de Serviço'}
                </h3>
                <span className="text-[10px] bg-white/20 text-sky-200 px-2 py-0.5 rounded-full font-bold uppercase shrink-0">
                  {isPdf ? 'Documento PDF' : 'Foto / Imagem Digitalizada'}
                </span>
              </div>
              <p className="text-slate-300 text-xs mt-0.5 truncate flex items-center gap-2">
                <span>Placa: <strong>{service.placa}</strong></span>
                <span>•</span>
                <span>Fornecedor: <strong>{service.fornecedor}</strong></span>
                <span>•</span>
                <span>R$ {service.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0 ml-2">
            {doc.urlBase64 && (
              <>
                <button
                  type="button"
                  onClick={handleDownload}
                  className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors text-xs flex items-center gap-1 font-semibold"
                  title="Baixar Arquivo da Nota"
                >
                  <Download className="w-4 h-4" />
                  <span className="hidden sm:inline">Baixar</span>
                </button>

                <button
                  type="button"
                  onClick={handlePrint}
                  className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors text-xs flex items-center gap-1 font-semibold"
                  title="Imprimir Documento"
                >
                  <Printer className="w-4 h-4" />
                  <span className="hidden sm:inline">Imprimir</span>
                </button>
              </>
            )}

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-black/20 hover:bg-black/30 flex items-center justify-center text-white transition-colors ml-1"
              title="Fechar Visualizador"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Toolbar for image controls */}
        {isImage && doc.urlBase64 && (
          <div className="bg-slate-100 border-b border-slate-200 px-4 py-2 flex items-center justify-between text-xs text-slate-600 shrink-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-700">Controles de Visualização:</span>
              <button
                type="button"
                onClick={handleZoomIn}
                className="p-1.5 bg-white hover:bg-slate-200 border border-slate-300 rounded-md text-slate-700"
                title="Aumentar Zoom (+)"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleZoomOut}
                className="p-1.5 bg-white hover:bg-slate-200 border border-slate-300 rounded-md text-slate-700"
                title="Diminuir Zoom (-)"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleRotate}
                className="p-1.5 bg-white hover:bg-slate-200 border border-slate-300 rounded-md text-slate-700 flex items-center gap-1"
                title="Girar 90 Graus"
              >
                <RotateCw className="w-3.5 h-3.5" />
                <span className="text-[10px]">{rotation}°</span>
              </button>
              <button
                type="button"
                onClick={handleResetZoom}
                className="text-[11px] text-sky-700 hover:text-sky-900 font-semibold px-2 py-1"
              >
                Ajustar Tamanho
              </button>
            </div>

            <div className="text-[11px] text-slate-500 font-medium">
              Zoom: {Math.round(zoomLevel * 100)}%
            </div>
          </div>
        )}

        {/* Document Body Viewer */}
        <div className="flex-1 overflow-auto bg-slate-900/90 p-4 sm:p-6 flex items-center justify-center min-h-[400px] max-h-[68vh]">
          {doc.urlBase64 ? (
            isPdf ? (
              <div className="w-full h-full min-h-[500px] flex flex-col bg-white rounded-xl overflow-hidden shadow-lg border border-slate-300">
                <object
                  data={doc.urlBase64}
                  type="application/pdf"
                  className="w-full h-full min-h-[460px] flex-1"
                >
                  {/* Fallback if browser blocks embedded PDF data URL */}
                  <div className="p-8 text-center space-y-4 flex flex-col items-center justify-center h-full">
                    <FileText className="w-16 h-16 text-red-500 animate-pulse" />
                    <div>
                      <h4 className="font-bold text-slate-900 text-base">Documento PDF Pronto para Consulta</h4>
                      <p className="text-xs text-slate-600 mt-1 max-w-md">
                        O arquivo <strong>{doc.nome}</strong> está arquivado com segurança no histórico do veículo {service.placa}.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleDownload}
                      className="bg-[#0F2744] hover:bg-slate-800 text-white font-bold px-5 py-2.5 rounded-xl text-xs flex items-center gap-2 shadow-md"
                    >
                      <Download className="w-4 h-4 text-sky-400" />
                      <span>Baixar &amp; Abrir PDF no Dispositivo</span>
                    </button>
                  </div>
                </object>
              </div>
            ) : (
              <div className="overflow-auto max-w-full max-h-full flex items-center justify-center p-2">
                <img
                  src={doc.urlBase64}
                  alt={`Nota Fiscal ${service.placa}`}
                  style={{
                    transform: `scale(${zoomLevel}) rotate(${rotation}deg)`,
                    transition: 'transform 0.15s ease-out',
                  }}
                  className="max-w-full max-h-[62vh] object-contain rounded-lg shadow-2xl bg-white border border-slate-700 select-none"
                />
              </div>
            )
          ) : (
            /* Demo / Mock Document Graphic if no binary base64 string */
            <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 text-slate-800 space-y-4 border border-slate-200">
              <div className="border-b pb-3 flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-sm text-[#0F2744] uppercase tracking-wider">
                    DANFE / Ordem de Serviço Arquivada
                  </h4>
                  <p className="text-xs text-slate-500 font-mono mt-0.5">
                    Arquivo: {doc.nome}
                  </p>
                </div>
                <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded">
                  {doc.tipo}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-3 rounded-lg border border-slate-200">
                <div>
                  <span className="text-slate-500 block text-[10px]">Veículo:</span>
                  <strong className="text-slate-900">{service.modelo}</strong>
                  <div className="font-mono text-sky-700">{service.placa}</div>
                </div>

                <div>
                  <span className="text-slate-500 block text-[10px]">Oficina / Emitente:</span>
                  <strong className="text-slate-900">{service.fornecedor}</strong>
                  <div className="text-slate-500">Data: {service.data.split('-').reverse().join('/')}</div>
                </div>

                <div>
                  <span className="text-slate-500 block text-[10px]">Odômetro Registrado:</span>
                  <strong className="text-slate-900 font-mono">{service.odometro.toLocaleString()} km</strong>
                </div>

                <div>
                  <span className="text-slate-500 block text-[10px]">Valor Total da Nota:</span>
                  <strong className="text-emerald-700 font-bold text-sm">
                    R$ {service.valorTotal.toFixed(2)}
                  </strong>
                </div>
              </div>

              <div className="p-3 bg-sky-50 rounded-lg border border-sky-200 text-xs text-sky-900 flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Processado pela Inteligência Artificial ({service.provedorIA || 'IA'})</p>
                  <p className="text-[11px] text-sky-800 mt-0.5">
                    Os itens da nota, valores de peças e serviços foram extraídos via OCR multimodal e vinculados permanentemente ao histórico do carro.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Summary */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-600 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2">
            <LicensePlateBadge placa={service.placa} size="sm" />
            <span className="text-slate-700 font-medium">
              {service.modelo} • Realizado em {service.data.split('-').reverse().join('/')}
            </span>
            {service.iaGerado && (
              <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded font-bold inline-flex items-center gap-1">
                <Sparkles className="w-2.5 h-2.5 text-emerald-600" /> IA {service.provedorIA || ''}
              </span>
            )}
          </div>

          <div className="text-slate-500 text-[11px] flex items-center gap-2">
            <span>Registrado por: <strong>{service.criadoPorNome || 'Sistema'}</strong></span>
            <span>•</span>
            <span className="font-mono font-bold text-slate-800">
              R$ {service.valorTotal.toFixed(2)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
