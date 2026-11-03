import React, { useState, useEffect, useRef, useMemo } from 'react';
import * as d3 from 'd3';
import {
  BarChart3,
  PieChart as PieIcon,
  Calendar,
  Filter,
  DollarSign,
  Wrench,
  Car,
  Download,
  Printer,
  TrendingUp,
  Layers,
  Sparkles,
  Info,
  Clock,
  ArrowUpDown,
  RotateCcw,
  Building2,
} from 'lucide-react';
import { Vehicle, ServiceLog, MaintenanceType, Supplier } from '../types';
import { LicensePlateBadge } from './LicensePlateBadge';

interface ReportsViewProps {
  vehicles: Vehicle[];
  services: ServiceLog[];
  suppliers?: Supplier[];
}

type PeriodPreset = '30d' | '60d' | '90d' | '2026' | 'all' | 'custom';

const MAINTENANCE_TYPE_LABELS: Record<MaintenanceType, string> = {
  OLEO: 'Troca de Óleo',
  MECANICA: 'Mecânica Geral',
  ELETRICA: 'Elétrica & Bateria',
  PNEU: 'Pneus & Alinhamento',
  FUNILARIA: 'Funilaria & Pintura',
  REVISAO_PROGRAMADA: 'Revisão Programada',
  VISTORIA: 'Vistoria Preventiva',
  OUTROS: 'Outros Serviços',
};

const CATEGORY_COLORS: Record<string, string> = {
  OLEO: '#0284C7', // Sky 600
  MECANICA: '#0F2744', // Dark Navy
  ELETRICA: '#EAB308', // Amber 500
  PNEU: '#10B981', // Emerald 500
  FUNILARIA: '#F97316', // Orange 500
  REVISAO_PROGRAMADA: '#6366F1', // Indigo 500
  VISTORIA: '#8B5CF6', // Violet 500
  OUTROS: '#64748B', // Slate 500
};

export const ReportsView: React.FC<ReportsViewProps> = ({ vehicles, services, suppliers = [] }) => {
  // Period filter states
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Additional filters
  const [selectedVehicle, setSelectedVehicle] = useState<string>('ALL');
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [selectedSupplier, setSelectedSupplier] = useState<string>('ALL');
  const [costChartMode, setCostChartMode] = useState<'total' | 'stacked'>('stacked');

  // Chart SVG refs
  const costBarChartRef = useRef<SVGSVGElement | null>(null);
  const freqBarChartRef = useRef<SVGSVGElement | null>(null);
  const costPieChartRef = useRef<SVGSVGElement | null>(null);
  const freqPieChartRef = useRef<SVGSVGElement | null>(null);
  const timelineBarChartRef = useRef<SVGSVGElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);

  // Set default date range on mount or preset change
  useEffect(() => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    if (periodPreset === '30d') {
      const past = new Date();
      past.setDate(today.getDate() - 30);
      setStartDate(past.toISOString().split('T')[0]);
      setEndDate(todayStr);
    } else if (periodPreset === '60d') {
      const past = new Date();
      past.setDate(today.getDate() - 60);
      setStartDate(past.toISOString().split('T')[0]);
      setEndDate(todayStr);
    } else if (periodPreset === '90d') {
      const past = new Date();
      past.setDate(today.getDate() - 90);
      setStartDate(past.toISOString().split('T')[0]);
      setEndDate(todayStr);
    } else if (periodPreset === '2026') {
      setStartDate('2026-01-01');
      setEndDate('2026-12-31');
    } else if (periodPreset === 'all') {
      setStartDate('');
      setEndDate('');
    }
  }, [periodPreset]);

  // Filtered dataset
  const filteredServices = useMemo(() => {
    return services.filter(s => {
      // Vehicle filter
      if (selectedVehicle !== 'ALL' && s.placa !== selectedVehicle && s.veiculoId !== selectedVehicle) {
        return false;
      }
      // Type filter
      if (selectedType !== 'ALL' && s.tipo !== selectedType) {
        return false;
      }
      // Supplier filter
      if (selectedSupplier !== 'ALL') {
        const matchesId = s.fornecedorId === selectedSupplier;
        const matchesName = suppliers.some(
          sup =>
            sup.id === selectedSupplier &&
            ((sup.fantasia && s.fornecedor && s.fornecedor.toLowerCase().includes(sup.fantasia.toLowerCase())) ||
             (sup.razaoSocial && s.fornecedor && s.fornecedor.toLowerCase().includes(sup.razaoSocial.toLowerCase())))
        );
        if (!matchesId && !matchesName) {
          return false;
        }
      }
      // Date filter
      if (startDate && s.data < startDate) {
        return false;
      }
      if (endDate && s.data > endDate) {
        return false;
      }
      return true;
    });
  }, [services, selectedVehicle, selectedType, selectedSupplier, suppliers, startDate, endDate]);

  // Aggregated KPI metrics
  const totalCusto = useMemo(() => {
    return filteredServices.reduce((sum, s) => sum + (s.valorTotal || 0), 0);
  }, [filteredServices]);

  const totalPecas = useMemo(() => {
    return filteredServices.reduce((sum, s) => sum + (s.valorPecas || 0), 0);
  }, [filteredServices]);

  const totalMaoDeObra = useMemo(() => {
    return filteredServices.reduce((sum, s) => sum + (s.valorMaoDeObra || 0), 0);
  }, [filteredServices]);

  const countOS = filteredServices.length;
  const custoMedioPorOS = countOS > 0 ? totalCusto / countOS : 0;

  // Aggregated by Vehicle (Cost & Frequency)
  const vehicleStats = useMemo(() => {
    const map = new Map<
      string,
      {
        placa: string;
        modelo: string;
        totalCusto: number;
        valorPecas: number;
        valorMaoDeObra: number;
        frequencia: number;
      }
    >();

    // Initialize all existing fleet vehicles
    vehicles.forEach(v => {
      map.set(v.placa, {
        placa: v.placa,
        modelo: v.modelo,
        totalCusto: 0,
        valorPecas: 0,
        valorMaoDeObra: 0,
        frequencia: 0,
      });
    });

    // Populate with filtered services
    filteredServices.forEach(s => {
      const existing = map.get(s.placa) || {
        placa: s.placa,
        modelo: s.modelo || 'Veículo',
        totalCusto: 0,
        valorPecas: 0,
        valorMaoDeObra: 0,
        frequencia: 0,
      };
      existing.totalCusto += s.valorTotal || 0;
      existing.valorPecas += s.valorPecas || 0;
      existing.valorMaoDeObra += s.valorMaoDeObra || 0;
      existing.frequencia += 1;
      map.set(s.placa, existing);
    });

    const arr = Array.from(map.values());
    // Filter to only vehicles that have services or if vehicle is selected
    if (selectedVehicle !== 'ALL') {
      return arr.filter(v => v.placa === selectedVehicle);
    }
    // Show vehicles sorted by cost desc, or top frequency
    return arr.filter(v => v.frequencia > 0).sort((a, b) => b.totalCusto - a.totalCusto);
  }, [vehicles, filteredServices, selectedVehicle]);

  // Top Cost Vehicle & Top Frequency Vehicle
  const topCostVehicle = useMemo(() => {
    if (vehicleStats.length === 0) return null;
    return [...vehicleStats].sort((a, b) => b.totalCusto - a.totalCusto)[0];
  }, [vehicleStats]);

  const topFreqVehicle = useMemo(() => {
    if (vehicleStats.length === 0) return null;
    return [...vehicleStats].sort((a, b) => b.frequencia - a.frequencia)[0];
  }, [vehicleStats]);

  // Aggregated by Supplier (Cost & Frequency)
  const supplierStats = useMemo(() => {
    const map = new Map<
      string,
      {
        id: string;
        nome: string;
        categoria?: string;
        cidade?: string;
        uf?: string;
        totalCusto: number;
        valorPecas: number;
        valorMaoDeObra: number;
        frequencia: number;
        ultimoAtendimento?: string;
      }
    >();

    // Pre-populate registered suppliers
    suppliers.forEach(sup => {
      map.set(sup.id, {
        id: sup.id,
        nome: sup.fantasia || sup.razaoSocial,
        categoria: sup.categoria,
        cidade: sup.cidade,
        uf: sup.uf,
        totalCusto: 0,
        valorPecas: 0,
        valorMaoDeObra: 0,
        frequencia: 0,
      });
    });

    // Populate with services matching current filters
    filteredServices.forEach(s => {
      let key = s.fornecedorId;
      if (!key) {
        const found = suppliers.find(
          sup =>
            (sup.fantasia && s.fornecedor && s.fornecedor.toLowerCase().includes(sup.fantasia.toLowerCase())) ||
            (sup.razaoSocial && s.fornecedor && s.fornecedor.toLowerCase().includes(sup.razaoSocial.toLowerCase()))
        );
        key = found ? found.id : `fornecedor_${s.fornecedor || 'Desconhecido'}`;
      }

      const existing = map.get(key) || {
        id: key,
        nome: s.fornecedor || 'Fornecedor Não Identificado',
        totalCusto: 0,
        valorPecas: 0,
        valorMaoDeObra: 0,
        frequencia: 0,
      };

      existing.totalCusto += s.valorTotal || 0;
      existing.valorPecas += s.valorPecas || 0;
      existing.valorMaoDeObra += s.valorMaoDeObra || 0;
      existing.frequencia += 1;
      if (!existing.ultimoAtendimento || s.data > existing.ultimoAtendimento) {
        existing.ultimoAtendimento = s.data;
      }
      map.set(key, existing);
    });

    const list = Array.from(map.values()).filter(sup => sup.frequencia > 0);
    return list.sort((a, b) => b.totalCusto - a.totalCusto);
  }, [suppliers, filteredServices]);

  // Aggregated by Maintenance Type (Cost & Frequency)
  const typeStats = useMemo(() => {
    const map = new Map<
      string,
      {
        tipo: MaintenanceType;
        label: string;
        totalCusto: number;
        frequencia: number;
        color: string;
      }
    >();

    filteredServices.forEach(s => {
      const tipo = s.tipo || 'OUTROS';
      const existing = map.get(tipo) || {
        tipo,
        label: MAINTENANCE_TYPE_LABELS[tipo] || tipo,
        totalCusto: 0,
        frequencia: 0,
        color: CATEGORY_COLORS[tipo] || '#64748B',
      };
      existing.totalCusto += s.valorTotal || 0;
      existing.frequencia += 1;
      map.set(tipo, existing);
    });

    return Array.from(map.values()).sort((a, b) => b.totalCusto - a.totalCusto);
  }, [filteredServices]);

  // Aggregated by Month Timeline
  const monthlyStats = useMemo(() => {
    const map = new Map<string, { mesAno: string; label: string; totalCusto: number; frequencia: number }>();

    filteredServices.forEach(s => {
      const datePart = s.data || '2026-01-01';
      const ym = datePart.substring(0, 7); // "YYYY-MM"
      const [year, month] = ym.split('-');
      const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
      const monthIdx = parseInt(month, 10) - 1;
      const label = `${monthNames[monthIdx] || month}/${year.substring(2)}`;

      const existing = map.get(ym) || {
        mesAno: ym,
        label,
        totalCusto: 0,
        frequencia: 0,
      };
      existing.totalCusto += s.valorTotal || 0;
      existing.frequencia += 1;
      map.set(ym, existing);
    });

    return Array.from(map.values()).sort((a, b) => a.mesAno.localeCompare(b.mesAno));
  }, [filteredServices]);

  // ==========================================
  // D3 CHART 1: CUSTOS POR VEÍCULO (BAR CHART)
  // ==========================================
  useEffect(() => {
    if (!costBarChartRef.current) return;
    const svgEl = costBarChartRef.current;
    d3.select(svgEl).selectAll('*').remove();

    if (vehicleStats.length === 0) return;

    const margin = { top: 30, right: 25, bottom: 65, left: 75 };
    const width = svgEl.clientWidth || 550;
    const height = 300;
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const svg = d3
      .select(svgEl)
      .attr('viewBox', `0 0 ${width} ${height}`)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const x = d3
      .scaleBand()
      .domain(vehicleStats.map(d => d.placa))
      .range([0, innerWidth])
      .padding(0.35);

    const maxVal = d3.max(vehicleStats, d => d.totalCusto) || 1000;
    const y = d3
      .scaleLinear()
      .domain([0, maxVal * 1.15])
      .nice()
      .range([innerHeight, 0]);

    // Gridlines
    svg
      .append('g')
      .attr('class', 'grid text-slate-200 stroke-slate-200 stroke-dasharray-2')
      .call(
        d3
          .axisLeft(y)
          .tickSize(-innerWidth)
          .tickFormat(() => '')
      )
      .call(g => g.select('.domain').remove());

    // X Axis
    svg
      .append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(d3.axisBottom(x))
      .selectAll('text')
      .attr('class', 'text-[11px] font-bold fill-slate-700')
      .attr('transform', 'rotate(-15)')
      .style('text-anchor', 'end');

    // Y Axis
    svg
      .append('g')
      .call(
        d3.axisLeft(y).ticks(5).tickFormat(d => `R$ ${(Number(d) / 1000).toFixed(0)}k`)
      )
      .selectAll('text')
      .attr('class', 'text-[10px] font-medium fill-slate-500');

    svg.select('.domain').attr('class', 'stroke-slate-300');

    // Tooltip helper
    const showTooltip = (event: MouseEvent, text: string) => {
      if (!tooltipRef.current) return;
      const tooltip = tooltipRef.current;
      tooltip.innerHTML = text;
      tooltip.style.opacity = '1';
      tooltip.style.left = `${event.pageX + 12}px`;
      tooltip.style.top = `${event.pageY - 28}px`;
    };

    const hideTooltip = () => {
      if (!tooltipRef.current) return;
      tooltipRef.current.style.opacity = '0';
    };

    if (costChartMode === 'total') {
      // Simple Total Bars
      svg
        .selectAll('.bar')
        .data(vehicleStats)
        .enter()
        .append('rect')
        .attr('class', 'bar cursor-pointer')
        .attr('x', d => x(d.placa) || 0)
        .attr('width', x.bandwidth())
        .attr('y', innerHeight)
        .attr('height', 0)
        .attr('rx', 4)
        .attr('fill', '#0284C7')
        .on('mousemove', (event, d) => {
          showTooltip(
            event,
            `<div class="font-bold text-white text-xs mb-1">🚗 ${d.placa}</div>
             <div class="text-sky-200 text-[11px]">${d.modelo}</div>
             <div class="mt-1 pt-1 border-t border-slate-700 text-xs">
               <span class="text-slate-300">Custo Total:</span> <strong class="text-white">R$ ${d.totalCusto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
             </div>
             <div class="text-[10px] text-slate-400">Ordens de Serviço: ${d.frequencia}</div>`
          );
        })
        .on('mouseleave', hideTooltip)
        .transition()
        .duration(750)
        .ease(d3.easeCubicOut)
        .attr('y', d => y(d.totalCusto))
        .attr('height', d => innerHeight - y(d.totalCusto));
    } else {
      // Stacked Bars (Peças vs Mão de Obra)
      const stack = d3.stack<any>().keys(['valorPecas', 'valorMaoDeObra']);
      const series = stack(vehicleStats);
      const colorScale = d3.scaleOrdinal<string>().domain(['valorPecas', 'valorMaoDeObra']).range(['#0284C7', '#0F2744']);

      const layer = svg
        .selectAll('.layer')
        .data(series)
        .enter()
        .append('g')
        .attr('class', 'layer')
        .attr('fill', d => colorScale(d.key));

      layer
        .selectAll('rect')
        .data(d => d)
        .enter()
        .append('rect')
        .attr('class', 'cursor-pointer')
        .attr('x', (d: any) => x(d.data.placa) || 0)
        .attr('width', x.bandwidth())
        .attr('y', innerHeight)
        .attr('height', 0)
        .attr('rx', 2)
        .on('mousemove', (event, d: any) => {
          const item = d.data;
          showTooltip(
            event,
            `<div class="font-bold text-white text-xs mb-1">🚗 ${item.placa} - ${item.modelo}</div>
             <div class="space-y-0.5 text-[11px]">
               <div class="text-sky-300">🔧 Peças: <strong>R$ ${item.valorPecas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></div>
               <div class="text-slate-300">👨‍🔧 Mão de Obra: <strong>R$ ${item.valorMaoDeObra.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></div>
               <div class="pt-1 mt-1 border-t border-slate-700 text-white font-bold">Total: R$ ${item.totalCusto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
             </div>`
          );
        })
        .on('mouseleave', hideTooltip)
        .transition()
        .duration(750)
        .ease(d3.easeCubicOut)
        .attr('y', (d: any) => y(d[1]))
        .attr('height', (d: any) => y(d[0]) - y(d[1]));
    }

    // Top value labels
    svg
      .selectAll('.label')
      .data(vehicleStats)
      .enter()
      .append('text')
      .attr('class', 'text-[10px] font-bold fill-slate-700 text-center')
      .attr('x', d => (x(d.placa) || 0) + x.bandwidth() / 2)
      .attr('y', d => y(d.totalCusto) - 6)
      .attr('text-anchor', 'middle')
      .text(d => `R$ ${(d.totalCusto / 1000).toFixed(1)}k`);
  }, [vehicleStats, costChartMode]);

  // ===============================================
  // D3 CHART 2: FREQUÊNCIA DE SERVIÇOS POR VEÍCULO
  // ===============================================
  useEffect(() => {
    if (!freqBarChartRef.current) return;
    const svgEl = freqBarChartRef.current;
    d3.select(svgEl).selectAll('*').remove();

    if (vehicleStats.length === 0) return;

    const margin = { top: 25, right: 25, bottom: 65, left: 45 };
    const width = svgEl.clientWidth || 550;
    const height = 300;
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const svg = d3
      .select(svgEl)
      .attr('viewBox', `0 0 ${width} ${height}`)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const sortedByFreq = [...vehicleStats].sort((a, b) => b.frequencia - a.frequencia);

    const x = d3
      .scaleBand()
      .domain(sortedByFreq.map(d => d.placa))
      .range([0, innerWidth])
      .padding(0.35);

    const maxFreq = d3.max(sortedByFreq, d => d.frequencia) || 5;
    const y = d3
      .scaleLinear()
      .domain([0, maxFreq + 1])
      .nice()
      .range([innerHeight, 0]);

    // Gridlines
    svg
      .append('g')
      .attr('class', 'grid text-slate-200 stroke-slate-200 stroke-dasharray-2')
      .call(
        d3
          .axisLeft(y)
          .ticks(Math.min(maxFreq, 6))
          .tickSize(-innerWidth)
          .tickFormat(() => '')
      )
      .call(g => g.select('.domain').remove());

    // X Axis
    svg
      .append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(d3.axisBottom(x))
      .selectAll('text')
      .attr('class', 'text-[11px] font-bold fill-slate-700')
      .attr('transform', 'rotate(-15)')
      .style('text-anchor', 'end');

    // Y Axis
    svg
      .append('g')
      .call(d3.axisLeft(y).ticks(Math.min(maxFreq, 5)).tickFormat(d3.format('d')))
      .selectAll('text')
      .attr('class', 'text-[10px] font-medium fill-slate-500');

    svg.select('.domain').attr('class', 'stroke-slate-300');

    // Tooltip helper
    const showTooltip = (event: MouseEvent, text: string) => {
      if (!tooltipRef.current) return;
      const tooltip = tooltipRef.current;
      tooltip.innerHTML = text;
      tooltip.style.opacity = '1';
      tooltip.style.left = `${event.pageX + 12}px`;
      tooltip.style.top = `${event.pageY - 28}px`;
    };

    const hideTooltip = () => {
      if (!tooltipRef.current) return;
      tooltipRef.current.style.opacity = '0';
    };

    // Bars
    svg
      .selectAll('.freq-bar')
      .data(sortedByFreq)
      .enter()
      .append('rect')
      .attr('class', 'freq-bar cursor-pointer')
      .attr('x', d => x(d.placa) || 0)
      .attr('width', x.bandwidth())
      .attr('y', innerHeight)
      .attr('height', 0)
      .attr('rx', 4)
      .attr('fill', '#10B981') // Emerald 500
      .on('mousemove', (event, d) => {
        const media = d.frequencia > 0 ? d.totalCusto / d.frequencia : 0;
        showTooltip(
          event,
          `<div class="font-bold text-white text-xs mb-1">🚗 ${d.placa} - ${d.modelo}</div>
           <div class="text-emerald-300 text-[11px] font-bold">Frequência: ${d.frequencia} Ordens de Serviço</div>
           <div class="text-slate-300 text-[10px]">Custo Médio por OS: R$ ${media.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
           <div class="text-slate-300 text-[10px]">Total Investido: R$ ${d.totalCusto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>`
        );
      })
      .on('mouseleave', hideTooltip)
      .transition()
      .duration(750)
      .ease(d3.easeCubicOut)
      .attr('y', d => y(d.frequencia))
      .attr('height', d => innerHeight - y(d.frequencia));

    // Value Labels on top of bars
    svg
      .selectAll('.freq-label')
      .data(sortedByFreq)
      .enter()
      .append('text')
      .attr('class', 'text-[11px] font-black fill-slate-800')
      .attr('x', d => (x(d.placa) || 0) + x.bandwidth() / 2)
      .attr('y', d => y(d.frequencia) - 6)
      .attr('text-anchor', 'middle')
      .text(d => `${d.frequencia} OS`);
  }, [vehicleStats]);

  // ====================================================
  // D3 CHART 3: CUSTO POR TIPO DE MANUTENÇÃO (PIE/DONUT)
  // ====================================================
  useEffect(() => {
    if (!costPieChartRef.current) return;
    const svgEl = costPieChartRef.current;
    d3.select(svgEl).selectAll('*').remove();

    if (typeStats.length === 0 || totalCusto === 0) return;

    const width = svgEl.clientWidth || 360;
    const height = 300;
    const radius = Math.min(width, height) / 2 - 25;

    const svg = d3
      .select(svgEl)
      .attr('viewBox', `0 0 ${width} ${height}`)
      .append('g')
      .attr('transform', `translate(${width / 2},${height / 2})`);

    const pie = d3
      .pie<any>()
      .value(d => d.totalCusto)
      .sort(null);

    const arc = d3
      .arc<any>()
      .innerRadius(radius * 0.52) // Donut shape
      .outerRadius(radius);

    const arcHover = d3
      .arc<any>()
      .innerRadius(radius * 0.52)
      .outerRadius(radius + 6);

    const pieData = pie(typeStats);

    const showTooltip = (event: MouseEvent, text: string) => {
      if (!tooltipRef.current) return;
      const tooltip = tooltipRef.current;
      tooltip.innerHTML = text;
      tooltip.style.opacity = '1';
      tooltip.style.left = `${event.pageX + 12}px`;
      tooltip.style.top = `${event.pageY - 28}px`;
    };

    const hideTooltip = () => {
      if (!tooltipRef.current) return;
      tooltipRef.current.style.opacity = '0';
    };

    // Slices
    const paths = svg
      .selectAll('path')
      .data(pieData)
      .enter()
      .append('path')
      .attr('d', arc)
      .attr('fill', d => d.data.color)
      .attr('stroke', '#ffffff')
      .attr('stroke-width', 2)
      .attr('class', 'cursor-pointer transition-all duration-200')
      .on('mouseenter', function (event, d) {
        d3.select(this).transition().duration(150).attr('d', arcHover);
        const pct = ((d.data.totalCusto / totalCusto) * 100).toFixed(1);
        showTooltip(
          event,
          `<div class="font-bold text-white text-xs mb-1">${d.data.label}</div>
           <div class="text-sky-300 font-bold text-xs">R$ ${d.data.totalCusto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
           <div class="text-slate-300 text-[10px]">${pct}% do custo total da frota</div>
           <div class="text-slate-400 text-[10px] mt-0.5">${d.data.frequencia} manutenções registradas</div>`
        );
      })
      .on('mouseleave', function () {
        d3.select(this).transition().duration(150).attr('d', arc);
        hideTooltip();
      });

    // Center Donut text
    svg
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '-0.3em')
      .attr('class', 'text-[11px] font-bold fill-slate-400 uppercase tracking-wider')
      .text('Total Gasto');

    svg
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '1em')
      .attr('class', 'text-xs sm:text-sm font-extrabold fill-slate-800')
      .text(`R$ ${(totalCusto / 1000).toFixed(1)}k`);
  }, [typeStats, totalCusto]);

  // ========================================================
  // D3 CHART 4: FREQUÊNCIA POR TIPO DE MANUTENÇÃO (DONUT)
  // ========================================================
  useEffect(() => {
    if (!freqPieChartRef.current) return;
    const svgEl = freqPieChartRef.current;
    d3.select(svgEl).selectAll('*').remove();

    if (typeStats.length === 0 || countOS === 0) return;

    const width = svgEl.clientWidth || 360;
    const height = 300;
    const radius = Math.min(width, height) / 2 - 25;

    const svg = d3
      .select(svgEl)
      .attr('viewBox', `0 0 ${width} ${height}`)
      .append('g')
      .attr('transform', `translate(${width / 2},${height / 2})`);

    const pie = d3
      .pie<any>()
      .value(d => d.frequencia)
      .sort(null);

    const arc = d3
      .arc<any>()
      .innerRadius(radius * 0.52)
      .outerRadius(radius);

    const arcHover = d3
      .arc<any>()
      .innerRadius(radius * 0.52)
      .outerRadius(radius + 6);

    const pieData = pie(typeStats);

    const showTooltip = (event: MouseEvent, text: string) => {
      if (!tooltipRef.current) return;
      const tooltip = tooltipRef.current;
      tooltip.innerHTML = text;
      tooltip.style.opacity = '1';
      tooltip.style.left = `${event.pageX + 12}px`;
      tooltip.style.top = `${event.pageY - 28}px`;
    };

    const hideTooltip = () => {
      if (!tooltipRef.current) return;
      tooltipRef.current.style.opacity = '0';
    };

    svg
      .selectAll('path')
      .data(pieData)
      .enter()
      .append('path')
      .attr('d', arc)
      .attr('fill', d => d.data.color)
      .attr('stroke', '#ffffff')
      .attr('stroke-width', 2)
      .attr('class', 'cursor-pointer transition-all duration-200')
      .on('mouseenter', function (event, d) {
        d3.select(this).transition().duration(150).attr('d', arcHover);
        const pct = ((d.data.frequencia / countOS) * 100).toFixed(1);
        showTooltip(
          event,
          `<div class="font-bold text-white text-xs mb-1">${d.data.label}</div>
           <div class="text-emerald-300 font-bold text-xs">${d.data.frequencia} Ordens de Serviço</div>
           <div class="text-slate-300 text-[10px]">${pct}% do volume de manutenções</div>`
        );
      })
      .on('mouseleave', function () {
        d3.select(this).transition().duration(150).attr('d', arc);
        hideTooltip();
      });

    // Center Donut text
    svg
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '-0.3em')
      .attr('class', 'text-[11px] font-bold fill-slate-400 uppercase tracking-wider')
      .text('Volume Total');

    svg
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '1.1em')
      .attr('class', 'text-base font-extrabold fill-slate-800')
      .text(`${countOS} OS`);
  }, [typeStats, countOS]);

  // ====================================================
  // D3 CHART 5: EVOLUÇÃO TEMPORAL DE GASTOS (BAR CHART)
  // ====================================================
  useEffect(() => {
    if (!timelineBarChartRef.current) return;
    const svgEl = timelineBarChartRef.current;
    d3.select(svgEl).selectAll('*').remove();

    if (monthlyStats.length === 0) return;

    const margin = { top: 25, right: 25, bottom: 45, left: 65 };
    const width = svgEl.clientWidth || 900;
    const height = 240;
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const svg = d3
      .select(svgEl)
      .attr('viewBox', `0 0 ${width} ${height}`)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const x = d3
      .scaleBand()
      .domain(monthlyStats.map(d => d.label))
      .range([0, innerWidth])
      .padding(0.35);

    const maxVal = d3.max(monthlyStats, d => d.totalCusto) || 1000;
    const y = d3
      .scaleLinear()
      .domain([0, maxVal * 1.2])
      .nice()
      .range([innerHeight, 0]);

    // Gridlines
    svg
      .append('g')
      .attr('class', 'grid text-slate-200 stroke-slate-200 stroke-dasharray-2')
      .call(
        d3
          .axisLeft(y)
          .tickSize(-innerWidth)
          .tickFormat(() => '')
      )
      .call(g => g.select('.domain').remove());

    // X Axis
    svg
      .append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(d3.axisBottom(x))
      .selectAll('text')
      .attr('class', 'text-[11px] font-bold fill-slate-700');

    // Y Axis
    svg
      .append('g')
      .call(d3.axisLeft(y).ticks(4).tickFormat(d => `R$ ${(Number(d) / 1000).toFixed(0)}k`))
      .selectAll('text')
      .attr('class', 'text-[10px] font-medium fill-slate-500');

    svg.select('.domain').attr('class', 'stroke-slate-300');

    const showTooltip = (event: MouseEvent, text: string) => {
      if (!tooltipRef.current) return;
      const tooltip = tooltipRef.current;
      tooltip.innerHTML = text;
      tooltip.style.opacity = '1';
      tooltip.style.left = `${event.pageX + 12}px`;
      tooltip.style.top = `${event.pageY - 28}px`;
    };

    const hideTooltip = () => {
      if (!tooltipRef.current) return;
      tooltipRef.current.style.opacity = '0';
    };

    // Bars with gradient
    svg
      .selectAll('.time-bar')
      .data(monthlyStats)
      .enter()
      .append('rect')
      .attr('class', 'time-bar cursor-pointer')
      .attr('x', d => x(d.label) || 0)
      .attr('width', x.bandwidth())
      .attr('y', innerHeight)
      .attr('height', 0)
      .attr('rx', 4)
      .attr('fill', '#4F46E5') // Indigo 600
      .on('mousemove', (event, d) => {
        showTooltip(
          event,
          `<div class="font-bold text-white text-xs mb-1">📅 ${d.label}</div>
           <div class="text-indigo-200 font-bold text-xs">R$ ${d.totalCusto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
           <div class="text-slate-300 text-[10px]">${d.frequencia} ordens de serviço executadas</div>`
        );
      })
      .on('mouseleave', hideTooltip)
      .transition()
      .duration(750)
      .ease(d3.easeCubicOut)
      .attr('y', d => y(d.totalCusto))
      .attr('height', d => innerHeight - y(d.totalCusto));

    // Value Labels
    svg
      .selectAll('.time-label')
      .data(monthlyStats)
      .enter()
      .append('text')
      .attr('class', 'text-[10px] font-bold fill-slate-700')
      .attr('x', d => (x(d.label) || 0) + x.bandwidth() / 2)
      .attr('y', d => y(d.totalCusto) - 6)
      .attr('text-anchor', 'middle')
      .text(d => `R$ ${(d.totalCusto / 1000).toFixed(1)}k`);
  }, [monthlyStats]);

  // Export filtered dataset to CSV
  const handleExportCSV = () => {
    if (filteredServices.length === 0) {
      alert('Não há dados no período para exportar.');
      return;
    }

    const headers = ['ID', 'Placa', 'Modelo', 'Data', 'Tipo', 'Fornecedor', 'Odometro', 'Pecas_R$', 'MaoDeObra_R$', 'Total_R$', 'CriadoPor'];
    const rows = filteredServices.map(s => [
      s.id,
      s.placa,
      `"${s.modelo}"`,
      s.data,
      s.tipo,
      `"${s.fornecedor}"`,
      s.odometro,
      s.valorPecas.toFixed(2),
      s.valorMaoDeObra.toFixed(2),
      s.valorTotal.toFixed(2),
      `"${s.criadoPorNome || 'Sistema'}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `relatorio_manutencao_frota_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Floating D3 Tooltip */}
      <div
        ref={tooltipRef}
        className="pointer-events-none fixed z-50 rounded-lg bg-slate-900/95 px-3 py-2 text-white shadow-xl backdrop-blur-xs transition-opacity duration-150 border border-slate-700"
        style={{ opacity: 0 }}
      />

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-sky-600 to-indigo-700 flex items-center justify-center text-white shadow-sm">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-[#0F2744]">
                Relatórios Gerenciais de Manutenção (D3.js)
              </h1>
              <p className="text-slate-600 text-xs sm:text-sm mt-0.5">
                Gráficos analíticos de barras e pizza em D3.js: histórico de custos, proporção peças vs mão de obra e frequência operacional por veículo.
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg border border-slate-300 transition-colors"
            title="Exportar dados do período em planilha CSV"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exportar CSV</span>
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-[#0F2744] hover:bg-[#1E3A5F] text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
            title="Imprimir visualização executiva"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Imprimir</span>
          </button>
        </div>
      </div>

      {/* Filter Control Bar */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Quick Period Presets */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-bold text-slate-700 mr-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-sky-600" /> Período:
            </span>
            <button
              onClick={() => setPeriodPreset('30d')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                periodPreset === '30d' ? 'bg-sky-600 text-white shadow-xs' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Últimos 30 Dias
            </button>
            <button
              onClick={() => setPeriodPreset('60d')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                periodPreset === '60d' ? 'bg-sky-600 text-white shadow-xs' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              60 Dias
            </button>
            <button
              onClick={() => setPeriodPreset('90d')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                periodPreset === '90d' ? 'bg-sky-600 text-white shadow-xs' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              90 Dias
            </button>
            <button
              onClick={() => setPeriodPreset('2026')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                periodPreset === '2026' ? 'bg-sky-600 text-white shadow-xs' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Ano 2026
            </button>
            <button
              onClick={() => setPeriodPreset('all')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                periodPreset === 'all' ? 'bg-sky-600 text-white shadow-xs' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Todo o Período
            </button>
          </div>

          {/* Custom Date Pickers */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 font-medium">De:</span>
              <input
                type="date"
                value={startDate}
                onChange={e => {
                  setStartDate(e.target.value);
                  setPeriodPreset('custom');
                }}
                className="border border-slate-300 rounded-lg px-2.5 py-1 text-slate-800 text-xs font-medium focus:outline-sky-500"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 font-medium">Até:</span>
              <input
                type="date"
                value={endDate}
                onChange={e => {
                  setEndDate(e.target.value);
                  setPeriodPreset('custom');
                }}
                className="border border-slate-300 rounded-lg px-2.5 py-1 text-slate-800 text-xs font-medium focus:outline-sky-500"
              />
            </div>
          </div>
        </div>

        {/* Secondary filters: Vehicle & Category */}
        <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5">
              <Car className="w-3.5 h-3.5 text-slate-400" />
              <label className="font-semibold text-slate-700">Filtrar por Veículo:</label>
              <select
                value={selectedVehicle}
                onChange={e => setSelectedVehicle(e.target.value)}
                className="border border-slate-300 rounded-lg px-2 py-1 text-slate-800 font-medium bg-white focus:outline-sky-500"
              >
                <option value="ALL">Todos os Veículos da Frota ({vehicles.length})</option>
                {vehicles.map(v => (
                  <option key={v.id} value={v.placa}>
                    {v.placa} - {v.modelo}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <label className="font-semibold text-slate-700">Tipo de Serviço:</label>
              <select
                value={selectedType}
                onChange={e => setSelectedType(e.target.value)}
                className="border border-slate-300 rounded-lg px-2 py-1 text-slate-800 font-medium bg-white focus:outline-sky-500"
              >
                <option value="ALL">Todos os Tipos de Manutenção</option>
                <option value="OLEO">Troca de Óleo</option>
                <option value="PNEU">Pneus &amp; Alinhamento</option>
                <option value="MECANICA">Mecânica Geral</option>
                <option value="ELETRICA">Elétrica &amp; Bateria</option>
                <option value="FUNILARIA">Funilaria &amp; Pintura</option>
                <option value="REVISAO_PROGRAMADA">Revisão Programada</option>
                <option value="VISTORIA">Vistoria</option>
                <option value="OUTROS">Outros</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-slate-400" />
              <label className="font-semibold text-slate-700">Fornecedor:</label>
              <select
                value={selectedSupplier}
                onChange={e => setSelectedSupplier(e.target.value)}
                className="border border-slate-300 rounded-lg px-2 py-1 text-slate-800 font-medium bg-white focus:outline-sky-500 max-w-[210px] truncate"
              >
                <option value="ALL">Todos os Fornecedores ({suppliers.length > 0 ? suppliers.length : 'Todos'})</option>
                {suppliers.map(sup => (
                  <option key={sup.id} value={sup.id}>
                    {sup.fantasia || sup.razaoSocial} ({sup.cidade}-{sup.uf})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {(selectedVehicle !== 'ALL' || selectedType !== 'ALL' || selectedSupplier !== 'ALL' || periodPreset !== 'all') && (
            <button
              onClick={() => {
                setSelectedVehicle('ALL');
                setSelectedType('ALL');
                setSelectedSupplier('ALL');
                setPeriodPreset('all');
                setStartDate('');
                setEndDate('');
              }}
              className="text-sky-600 hover:text-sky-800 font-semibold flex items-center gap-1 hover:underline text-[11px]"
            >
              <RotateCcw className="w-3 h-3" /> Limpar Filtros
            </button>
          )}
        </div>
      </div>

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Cost */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Custo Total no Período</span>
            <div className="w-7 h-7 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-900">
            R$ {totalCusto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-slate-500 flex justify-between pt-1 border-t border-slate-100">
            <span>Peças: R$ {totalPecas.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}</span>
            <span>MO: R$ {totalMaoDeObra.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}</span>
          </div>
        </div>

        {/* OS Volume */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Ordens de Serviço</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Wrench className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-900">
            {countOS} <span className="text-xs font-normal text-slate-500">atendimentos</span>
          </div>
          <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-100">
            Média de <strong>R$ {custoMedioPorOS.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong> por OS
          </div>
        </div>

        {/* Highest Cost Vehicle */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Maior Custo Acumulado</span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          {topCostVehicle ? (
            <>
              <div className="flex items-center gap-2">
                <LicensePlateBadge placa={topCostVehicle.placa} size="sm" />
                <span className="font-bold text-slate-900 text-sm truncate">{topCostVehicle.modelo.split(' ')[0]}</span>
              </div>
              <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                Total: <strong className="text-slate-800">R$ {topCostVehicle.totalCusto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
              </div>
            </>
          ) : (
            <div className="text-xs text-slate-400 py-1">Nenhum registro</div>
          )}
        </div>

        {/* Highest Frequency Vehicle */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Mais Frequente na Oficina</span>
            <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Car className="w-4 h-4" />
            </div>
          </div>
          {topFreqVehicle ? (
            <>
              <div className="flex items-center gap-2">
                <LicensePlateBadge placa={topFreqVehicle.placa} size="sm" />
                <span className="font-bold text-slate-900 text-sm truncate">{topFreqVehicle.modelo.split(' ')[0]}</span>
              </div>
              <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                Frequência: <strong className="text-slate-800">{topFreqVehicle.frequencia} manutenções</strong>
              </div>
            </>
          ) : (
            <div className="text-xs text-slate-400 py-1">Nenhum registro</div>
          )}
        </div>
      </div>

      {/* Main Charts Grid: D3 Bars & Pies */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* CHART 1: Custos por Veículo (D3 Bar Chart) */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-sky-600" />
                <h2 className="font-bold text-[#0F2744] text-sm">
                  Histórico de Custos por Veículo (R$)
                </h2>
              </div>
              <p className="text-slate-500 text-xs mt-0.5">
                Investimento acumulado por placa no período selecionado
              </p>
            </div>

            {/* Toggle Total vs Stacked */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs font-semibold">
              <button
                type="button"
                onClick={() => setCostChartMode('stacked')}
                className={`px-2 py-1 rounded transition-all ${
                  costChartMode === 'stacked' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                }`}
              >
                Peças + MO
              </button>
              <button
                type="button"
                onClick={() => setCostChartMode('total')}
                className={`px-2 py-1 rounded transition-all ${
                  costChartMode === 'total' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                }`}
              >
                Custo Total
              </button>
            </div>
          </div>

          {/* D3 SVG Container */}
          <div className="w-full h-[300px] flex items-center justify-center">
            {vehicleStats.length === 0 ? (
              <div className="text-center text-slate-400 text-xs py-10">
                Nenhuma manutenção registrada para os filtros selecionados.
              </div>
            ) : (
              <svg ref={costBarChartRef} className="w-full h-full overflow-visible" />
            )}
          </div>

          {/* Legend */}
          <div className="flex items-center justify-center gap-4 text-[11px] text-slate-600 pt-2 border-t border-slate-100">
            {costChartMode === 'stacked' ? (
              <>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-sky-600"></span>
                  <span>Peças / Componentes</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-[#0F2744]"></span>
                  <span>Mão de Obra / Serviços</span>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-sky-600"></span>
                <span>Custo Total em Reais</span>
              </div>
            )}
          </div>
        </div>

        {/* CHART 2: Frequência de Serviços por Veículo (D3 Bar Chart) */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <Wrench className="w-4 h-4 text-emerald-600" />
                <h2 className="font-bold text-[#0F2744] text-sm">
                  Frequência de Serviços por Veículo
                </h2>
              </div>
              <p className="text-slate-500 text-xs mt-0.5">
                Quantidade de Ordens de Serviço (OS) realizadas por carro
              </p>
            </div>
            <span className="text-[11px] font-bold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-200">
              Total: {countOS} OS
            </span>
          </div>

          {/* D3 SVG Container */}
          <div className="w-full h-[300px] flex items-center justify-center">
            {vehicleStats.length === 0 ? (
              <div className="text-center text-slate-400 text-xs py-10">
                Nenhuma ordem de serviço no período.
              </div>
            ) : (
              <svg ref={freqBarChartRef} className="w-full h-full overflow-visible" />
            )}
          </div>

          {/* Legend */}
          <div className="flex items-center justify-center gap-4 text-[11px] text-slate-600 pt-2 border-t border-slate-100">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-emerald-500"></span>
              <span>Volume de Entradas na Oficina</span>
            </div>
          </div>
        </div>

        {/* CHART 3: Distribuição de Custos por Tipo de Manutenção (D3 Pie / Donut) */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-3">
          <div className="border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <PieIcon className="w-4 h-4 text-sky-600" />
              <h2 className="font-bold text-[#0F2744] text-sm">
                Distribuição de Custos por Categoria (R$)
              </h2>
            </div>
            <p className="text-slate-500 text-xs mt-0.5">
              Proporção percentual de despesas por tipo de manutenção
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="w-full sm:w-1/2 h-[260px] flex items-center justify-center">
              {typeStats.length === 0 ? (
                <div className="text-center text-slate-400 text-xs">Sem dados</div>
              ) : (
                <svg ref={costPieChartRef} className="w-full h-full overflow-visible" />
              )}
            </div>

            {/* Category breakdown legend */}
            <div className="w-full sm:w-1/2 space-y-1.5 text-xs">
              {typeStats.map(item => {
                const pct = totalCusto > 0 ? ((item.totalCusto / totalCusto) * 100).toFixed(1) : '0';
                return (
                  <div key={item.tipo} className="flex items-center justify-between p-1.5 rounded-lg hover:bg-slate-50">
                    <div className="flex items-center gap-2 truncate">
                      <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: item.color }}></span>
                      <span className="font-medium text-slate-700 truncate">{item.label}</span>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-bold text-slate-900">R$ {item.totalCusto.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}</div>
                      <div className="text-[10px] text-slate-400">{pct}%</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* CHART 4: Frequência de Serviços por Tipo (D3 Pie / Donut) */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-3">
          <div className="border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-600" />
              <h2 className="font-bold text-[#0F2744] text-sm">
                Frequência de Serviços por Categoria (OS)
              </h2>
            </div>
            <p className="text-slate-500 text-xs mt-0.5">
              Quantidade e distribuição das ordens de serviço por tipo
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="w-full sm:w-1/2 h-[260px] flex items-center justify-center">
              {typeStats.length === 0 ? (
                <div className="text-center text-slate-400 text-xs">Sem dados</div>
              ) : (
                <svg ref={freqPieChartRef} className="w-full h-full overflow-visible" />
              )}
            </div>

            {/* Legend */}
            <div className="w-full sm:w-1/2 space-y-1.5 text-xs">
              {typeStats.map(item => {
                const pct = countOS > 0 ? ((item.frequencia / countOS) * 100).toFixed(1) : '0';
                return (
                  <div key={item.tipo} className="flex items-center justify-between p-1.5 rounded-lg hover:bg-slate-50">
                    <div className="flex items-center gap-2 truncate">
                      <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: item.color }}></span>
                      <span className="font-medium text-slate-700 truncate">{item.label}</span>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-bold text-emerald-700">{item.frequencia} OS</div>
                      <div className="text-[10px] text-slate-400">{pct}%</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* CHART 5: Evolução Temporal dos Custos (Mensal) */}
      {monthlyStats.length > 1 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-3">
          <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-indigo-600" />
                <h2 className="font-bold text-[#0F2744] text-sm">
                  Evolução Mensal dos Custos de Manutenção
                </h2>
              </div>
              <p className="text-slate-500 text-xs mt-0.5">
                Comparativo de gastos acumulados mês a mês ao longo do período
              </p>
            </div>
            <span className="text-[11px] font-semibold text-slate-500">
              {monthlyStats.length} meses registrados
            </span>
          </div>

          <div className="w-full h-[240px] flex items-center justify-center">
            <svg ref={timelineBarChartRef} className="w-full h-full overflow-visible" />
          </div>
        </div>
      )}

      {/* SEÇÃO: Gastos por Fornecedor Credenciado */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-sky-600" />
              <h2 className="font-bold text-[#0F2744] text-sm sm:text-base">
                Gastos por Fornecedor Credenciado
              </h2>
            </div>
            <p className="text-slate-500 text-xs mt-0.5">
              Consolidado de pagamentos por oficina/autopeça com divisão de peças, mão de obra e volume de OS
            </p>
          </div>

          <div className="flex items-center gap-2">
            {selectedSupplier !== 'ALL' && (
              <span className="text-xs bg-sky-50 text-sky-700 px-2.5 py-1 rounded-lg border border-sky-200 font-semibold flex items-center gap-1.5">
                Filtrado: {suppliers.find(s => s.id === selectedSupplier)?.fantasia || 'Fornecedor'}
                <button
                  onClick={() => setSelectedSupplier('ALL')}
                  className="text-sky-500 hover:text-sky-800 font-bold ml-1"
                  title="Remover filtro de fornecedor"
                >
                  ×
                </button>
              </span>
            )}
            <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
              {supplierStats.length} {supplierStats.length === 1 ? 'fornecedor no relatório' : 'fornecedores no relatório'}
            </span>
          </div>
        </div>

        {supplierStats.length === 0 ? (
          <div className="text-center py-6 text-slate-400 text-xs">
            Nenhum gasto com fornecedores registrado no período ou filtro selecionado.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {supplierStats.map((sup, idx) => {
              const pct = totalCusto > 0 ? ((sup.totalCusto / totalCusto) * 100).toFixed(1) : '0';
              const isSelected = selectedSupplier === sup.id;
              return (
                <div
                  key={sup.id}
                  onClick={() => setSelectedSupplier(isSelected ? 'ALL' : sup.id)}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'border-sky-500 bg-sky-50/50 shadow-sm ring-1 ring-sky-500'
                      : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50/80 shadow-2xs'
                  }`}
                  title="Clique para filtrar os lançamentos deste fornecedor"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-black text-slate-400">#{idx + 1}</span>
                        <h4 className="font-bold text-slate-900 text-xs truncate" title={sup.nome}>
                          {sup.nome}
                        </h4>
                      </div>
                      {(sup.cidade || sup.categoria) && (
                        <p className="text-[10px] text-slate-500 truncate mt-0.5">
                          {sup.cidade && sup.uf ? `${sup.cidade}/${sup.uf} • ` : ''}
                          <span className="capitalize">{sup.categoria || 'Credenciado'}</span>
                        </p>
                      )}
                    </div>
                    <span className="text-[11px] font-bold text-slate-700 shrink-0 bg-slate-100 px-1.5 py-0.5 rounded">
                      {sup.frequencia} OS
                    </span>
                  </div>

                  {/* Valor Total e Barra Percentual */}
                  <div className="space-y-1.5 pt-1 border-t border-slate-100">
                    <div className="flex items-baseline justify-between">
                      <span className="text-[10px] font-semibold text-slate-500">Total Gasto:</span>
                      <span className="text-xs font-black text-emerald-700 font-mono">
                        R$ {sup.totalCusto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>

                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-sky-500 to-indigo-600 h-full rounded-full transition-all"
                        style={{ width: `${Math.min(100, Math.max(4, Number(pct)))}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-500 pt-0.5">
                      <span>Peças: R$ {sup.valorPecas.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}</span>
                      <span>M.O.: R$ {sup.valorMaoDeObra.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}</span>
                      <span className="font-bold text-slate-600">{pct}%</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Filtered Data Breakdown Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-[#0F2744] text-sm sm:text-base">
              Detalhamento de Ordens de Serviço do Relatório
            </h3>
            <p className="text-xs text-slate-500">
              {filteredServices.length} registros correspondentes aos filtros aplicados
            </p>
          </div>

          <div className="text-xs font-bold text-slate-700 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
            Total do Período: <span className="text-emerald-700 font-extrabold">R$ {totalCusto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100/70 text-slate-600 font-bold uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Veículo / Placa</th>
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Fornecedor</th>
                <th className="px-4 py-3 text-right">Odômetro</th>
                <th className="px-4 py-3 text-right">Peças</th>
                <th className="px-4 py-3 text-right">Mão de Obra</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3">Autor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-700">
              {filteredServices.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-slate-400">
                    Nenhum lançamento no período selecionado.
                  </td>
                </tr>
              ) : (
                filteredServices.map(srv => (
                  <tr key={srv.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-medium">
                      <div className="flex items-center gap-2">
                        <LicensePlateBadge placa={srv.placa} size="sm" />
                        <span className="font-bold text-slate-900">{srv.modelo}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {srv.data.split('-').reverse().join('/')}
                    </td>
                    <td className="px-4 py-3">
                      <span className="bg-slate-100 text-slate-800 font-semibold px-2 py-0.5 rounded text-[11px]">
                        {MAINTENANCE_TYPE_LABELS[srv.tipo] || srv.tipo}
                      </span>
                    </td>
                    <td className="px-4 py-3 max-w-[180px]" title={srv.fornecedor}>
                      <div className="flex items-center gap-1.5 truncate">
                        <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="font-medium text-slate-800 truncate">{srv.fornecedor}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {srv.odometro.toLocaleString()} km
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-600">
                      R$ {srv.valorPecas.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-600">
                      R$ {srv.valorMaoDeObra.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-slate-900 font-mono">
                      R$ {srv.valorTotal.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                      <span className="text-[11px] font-medium">{srv.criadoPorNome || 'Sistema'}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
