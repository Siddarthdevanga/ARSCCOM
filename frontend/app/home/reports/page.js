"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Download, Users, CalendarDays, TrendingUp, TrendingDown,
  CheckCircle, XCircle, Clock, AlertCircle, Activity, BarChart2,
  FileDown, RefreshCw, UserCheck, Layers, Calendar, Timer,
} from "lucide-react";
import styles from "./style.module.css";

const PERIODS = [
  { key:"today",   label:"Today"   },
  { key:"week",    label:"Week"    },
  { key:"month",   label:"Month"   },
  { key:"quarter", label:"Quarter" },
  { key:"year",    label:"Year"    },
];
const DOW_LABELS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const DOW_COLORS = ["#f59e0b","#10b981","#6366f1","#7c3aed","#0ea5e9","#ef4444","#f97316"];
const STATUS_META = {
  pending:     { label:"Pending",     color:"#f59e0b" },
  accepted:    { label:"Accepted",    color:"#10b981" },
  declined:    { label:"Declined",    color:"#ef4444" },
  checked_in:  { label:"Checked In",  color:"#6366f1" },
  checked_out:      { label:"Checked Out",      color:"#8b5cf6" },
  auto_checked_out: { label:"Auto Checked Out", color:"#6b7280" },
  BOOKED:      { label:"Booked",      color:"#7c3aed" },
  CANCELLED:   { label:"Cancelled",   color:"#ef4444" },
  COMPLETED:   { label:"Completed",   color:"#10b981" },
};
const SW=600,SH=180,PB=36,PT=16,PL=38,PR=8,CW=600-38-8,CH=180-16-36;

/* ── Toast ── */
function Toast({toast,onDismiss}){
  if(!toast)return null;
  const Icon=toast.type==="error"?XCircle:CheckCircle;
  return(
    <div className={`${styles.toast} ${styles[`toast_${toast.type}`]}`} role="alert">
      <Icon size={16}/><span>{toast.msg}</span>
      <button className={styles.toastClose} onClick={onDismiss}><XCircle size={14}/></button>
    </div>
  );
}

/* ── Period selector ── */
function PeriodSelector({value,onChange}){
  return(
    <div className={styles.periodBar}>
      {PERIODS.map(p=>(
        <button key={p.key}
          className={`${styles.periodBtn} ${value===p.key?styles.periodBtnActive:""}`}
          onClick={()=>onChange(p.key)}>{p.label}</button>
      ))}
    </div>
  );
}

/* ── KPI Card ── */
function KpiCard({label,value,prev,icon:Icon,accent,loading}){
  const pct=prev>0?Math.round(((value-prev)/prev)*100):null;
  const up=pct>=0;
  return(
    <div className={styles.kpiCard} style={{"--ka":accent}}>
      {loading&&<div className={styles.kpiSkeleton}/>}
      <div className={styles.kpiIconWrap} style={{background:`${accent}18`,color:accent}}><Icon size={20}/></div>
      <div className={styles.kpiBody}>
        <p className={styles.kpiLabel}>{label}</p>
        <p className={styles.kpiValue} style={{color:accent}}>{value??0}</p>
        {pct!==null&&(
          <p className={`${styles.kpiChange} ${up?styles.kpiUp:styles.kpiDown}`}>
            {up?<TrendingUp size={11}/>:<TrendingDown size={11}/>}
            {Math.abs(pct)}% vs prev
          </p>
        )}
      </div>
    </div>
  );
}

/* ── SVG Bar Chart ── */
function SvgBarChart({data,color,color2}){
  const [tip,setTip]=useState(null);
  if(!data?.length)return<EmptyChart/>;
  const max=Math.max(...data.map(d=>d.count),1);
  const bw=Math.max(5,Math.min(36,(CW/data.length)-2));
  const step=Math.ceil(data.length/10);
  const gid=`bc${color.replace(/[^a-z0-9]/gi,"")}`;
  const yVals=[0,Math.round(max*0.5),max];
  return(
    <div className={styles.svgWrap}>
      {tip&&(
        <div className={styles.svgTip} style={{left:`${Math.min((tip.xi/SW)*100,85)}%`,top:"4px"}}>
          <strong>{tip.count}</strong><span>{tip.date}</span>
        </div>
      )}
      <svg viewBox={`0 0 ${SW} ${SH}`} className={styles.svgChart} preserveAspectRatio="none">
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={color}       stopOpacity="1"/>
            <stop offset="100%" stopColor={color2||color} stopOpacity="0.5"/>
          </linearGradient>
        </defs>
        {yVals.map((v,i)=>{
          const y=PT+CH-(v/max)*CH;
          return(
            <g key={i}>
              <line x1={PL} y1={y} x2={SW-PR} y2={y} stroke="#e9e3f5" strokeWidth="1" strokeDasharray={i===0?"0":"3 3"}/>
              <text x={PL-4} y={y+4} textAnchor="end" fontSize="9" fill="#9ca3af">{v}</text>
            </g>
          );
        })}
        {data.map((d,i)=>{
          const bh=Math.max((d.count/max)*CH,d.count>0?4:0);
          const x=PL+(i/data.length)*CW+((CW/data.length)-bw)/2;
          const y=PT+CH-bh;
          const show=data.length<=8||i%step===0||i===data.length-1;
          const xi=x+bw/2;
          return(
            <g key={i} style={{cursor:"crosshair"}}
              onMouseEnter={()=>setTip({xi,count:d.count,date:d.date?.length>8?d.date.slice(5):d.date})}
              onMouseLeave={()=>setTip(null)}>
              <rect x={x} y={y} width={bw} height={bh} rx="3"
                fill={tip&&tip.xi===xi?color:`url(#${gid})`}
                opacity={tip&&tip.xi!==xi?0.5:1}/>
              {show&&<text x={xi} y={SH-4} textAnchor="middle" fontSize="8" fill="#9ca3af">
                {d.date?.length>8?d.date.slice(5):d.date}
              </text>}
            </g>
          );
        })}
        <line x1={PL} y1={PT+CH} x2={SW-PR} y2={PT+CH} stroke="#d8d0ef" strokeWidth="1.5"/>
      </svg>
    </div>
  );
}

/* ── SVG Line / Area Chart ── */
function SvgLineChart({data,color}){
  const [tip,setTip]=useState(null);
  if(!data?.length||data.length<2)return<EmptyChart msg="Not enough data points"/>;
  const max=Math.max(...data.map(d=>d.count),1);
  const pts=data.map((d,i)=>({
    x:PL+(i/(data.length-1))*CW,
    y:PT+CH-(d.count/max)*CH,
    d,
  }));
  const line=pts.map((p,i)=>`${i===0?"M":"L"}${p.x},${p.y}`).join(" ");
  const area=`${line} L${pts[pts.length-1].x},${PT+CH} L${pts[0].x},${PT+CH} Z`;
  const gid=`lc${color.replace(/[^a-z0-9]/gi,"")}`;
  const step=Math.ceil(data.length/10);
  const yVals=[0,Math.round(max*0.5),max];
  return(
    <div className={styles.svgWrap}>
      {tip&&(
        <div className={styles.svgTip} style={{left:`${Math.min((tip.x/SW)*100,85)}%`,top:`${(tip.y/SH)*100}%`}}>
          <strong>{tip.d.count}</strong><span>{tip.d.date?.length>8?tip.d.date.slice(5):tip.d.date}</span>
        </div>
      )}
      <svg viewBox={`0 0 ${SW} ${SH}`} className={styles.svgChart} preserveAspectRatio="none">
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={color} stopOpacity="0.28"/>
            <stop offset="100%" stopColor={color} stopOpacity="0.02"/>
          </linearGradient>
        </defs>
        {yVals.map((v,i)=>{
          const y=PT+CH-(v/max)*CH;
          return(
            <g key={i}>
              <line x1={PL} y1={y} x2={SW-PR} y2={y} stroke="#e9e3f5" strokeWidth="1" strokeDasharray={i===0?"0":"3 3"}/>
              <text x={PL-4} y={y+4} textAnchor="end" fontSize="9" fill="#9ca3af">{v}</text>
            </g>
          );
        })}
        <path d={area} fill={`url(#${gid})`}/>
        <path d={line} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round"/>
        {pts.map((p,i)=>{
          const show=data.length<=8||i%step===0||i===data.length-1;
          const hot=tip&&tip.d===p.d;
          return(
            <g key={i} style={{cursor:"crosshair"}}
              onMouseEnter={()=>setTip(p)} onMouseLeave={()=>setTip(null)}>
              <circle cx={p.x} cy={p.y} r={hot?5:3}
                fill={hot?"#fff":color} stroke={color} strokeWidth={hot?2:0}/>
              {show&&<text x={p.x} y={SH-4} textAnchor="middle" fontSize="8" fill="#9ca3af">
                {p.d.date?.length>8?p.d.date.slice(5):p.d.date}
              </text>}
            </g>
          );
        })}
        <line x1={PL} y1={PT+CH} x2={SW-PR} y2={PT+CH} stroke="#d8d0ef" strokeWidth="1.5"/>
      </svg>
    </div>
  );
}

/* ── SVG Donut ── */
function SvgDonut({data}){
  const total=data.reduce((s,d)=>s+(d.count||0),0);
  if(!total)return<EmptyChart icon={BarChart2}/>;
  const r=52,cx=70,cy=70,circ=2*Math.PI*r;
  let off=0;
  const slices=data.map(d=>{
    const key=d.status||d.name;
    const meta=STATUS_META[key]||{};
    const color=meta.color||"#a78bfa";
    const dash=(d.count/total)*circ;
    const s={...d,dash,off,color,label:meta.label||key};
    off+=dash;return s;
  });
  return(
    <div className={styles.donutWrap}>
      <svg viewBox="0 0 140 140" className={styles.donutSvg}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f0edf9" strokeWidth="20"/>
        {slices.map((s,i)=>(
          <circle key={i} cx={cx} cy={cy} r={r} fill="none"
            stroke={s.color} strokeWidth="20"
            strokeDasharray={`${s.dash} ${circ-s.dash}`}
            strokeDashoffset={-s.off+circ*0.25}
            className={styles.donutSlice}/>
        ))}
        <text x={cx} y={cy-7}  textAnchor="middle" fontSize="18" fontWeight="900" fill="#0f0629">{total}</text>
        <text x={cx} y={cy+10} textAnchor="middle" fontSize="7.5" fontWeight="700" fill="#9ca3af" letterSpacing="0.5">TOTAL</text>
      </svg>
      <div className={styles.donutLegend}>
        {slices.map((s,i)=>(
          <div key={i} className={styles.legendRow}>
            <span className={styles.legendDot} style={{background:s.color}}/>
            <span className={styles.legendName}>{s.label}</span>
            <span className={styles.legendCount}>{s.count}</span>
            <span className={styles.legendPct}>{((s.count/total)*100).toFixed(0)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Horizontal bar list ── */
function HBarList({data,color}){
  if(!data?.length)return<EmptyChart icon={AlertCircle}/>;
  const max=Math.max(...data.map(d=>d.count),1);
  return(
    <div className={styles.hBarList}>
      {data.slice(0,7).map((d,i)=>(
        <div key={i} className={styles.hBarItem}>
          <div className={styles.hBarMeta}>
            <span className={styles.hBarRank}>{i+1}</span>
            <span className={styles.hBarName}>{d.name||d.person_to_meet||"—"}</span>
            <span className={styles.hBarVal}>{d.count}</span>
          </div>
          <div className={styles.hBarTrack}>
            <div className={styles.hBarFill} style={{width:`${(d.count/max)*100}%`,background:color}}/>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Hourly heatmap ── */
function HeatmapChart({data,color}){
  const [tip,setTip]=useState(null);
  const filled=Array.from({length:24},(_,h)=>({
    hour:h,count:data?.find(d=>Number(d.hour)===h)?.count||0,
  }));
  const max=Math.max(...filled.map(d=>d.count),1);
  const ampm=h=>h===0?"12am":h<12?`${h}am`:h===12?"12pm":`${h-12}pm`;
  const CW2=22,GAP=2,H2=48,W2=24*(CW2+GAP)+4;
  return(
    <div className={styles.svgWrap}>
      {tip&&(
        <div className={styles.svgTip} style={{left:`${Math.min((tip.x/W2)*100,85)}%`,top:"0%"}}>
          <strong>{tip.count}</strong><span>{ampm(tip.hour)}</span>
        </div>
      )}
      <svg viewBox={`0 0 ${W2} ${H2+20}`} className={styles.svgHeat} preserveAspectRatio="none">
        {filled.map((d,i)=>{
          const x=2+i*(CW2+GAP);
          const inten=d.count/max;
          return(
            <g key={i}
              onMouseEnter={()=>setTip({x:x+CW2/2,hour:d.hour,count:d.count})}
              onMouseLeave={()=>setTip(null)}>
              <rect x={x} y={2} width={CW2} height={H2} rx="4"
                fill={d.count===0?"#f0edf9":color}
                opacity={d.count===0?1:0.12+inten*0.88}/>
              {i%4===0&&<text x={x+CW2/2} y={H2+16} textAnchor="middle" fontSize="7.5" fill="#9ca3af">{ampm(d.hour)}</text>}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/* ── Day-of-week chart ── */
function DowChart({data}){
  const filled=Array.from({length:7},(_,i)=>({
    day:DOW_LABELS[i],
    count:data?.find(d=>Number(d.dow)===i+1)?.count||0,
    color:DOW_COLORS[i],
  }));
  const max=Math.max(...filled.map(d=>d.count),1);
  const BW=52,GAP=8,H=90,LBL=24,W=7*(BW+GAP)-GAP+4;
  return(
    <svg viewBox={`0 0 ${W} ${H+LBL+4}`} className={styles.svgDow} preserveAspectRatio="none">
      {filled.map((d,i)=>{
        const bh=Math.max((d.count/max)*H,d.count>0?5:2);
        const x=2+i*(BW+GAP);
        const y=H-bh;
        return(
          <g key={i}>
            <rect x={x} y={y} width={BW} height={bh} rx="5"
              fill={d.color} opacity={d.count===0?0.1:0.88}/>
            {d.count>0&&(
              <text x={x+BW/2} y={y-5} textAnchor="middle" fontSize="10" fontWeight="800" fill={d.color}>{d.count}</text>
            )}
            <text x={x+BW/2} y={H+LBL} textAnchor="middle" fontSize="10.5" fontWeight="600" fill="#6b7280">{d.day}</text>
          </g>
        );
      })}
      <line x1={0} y1={H} x2={W} y2={H} stroke="#e9e3f5" strokeWidth="1.5"/>
    </svg>
  );
}

/* ── Progress Ring ── */
function ProgressRing({value,max,color,label,sub}){
  const pct=max>0?Math.min((value/max)*100,100):0;
  const r=36,cx=46,cy=46,circ=2*Math.PI*r;
  const dash=(pct/100)*circ;
  return(
    <div className={styles.ringWrap}>
      <svg viewBox="0 0 92 92" className={styles.ringSvg}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f0edf9" strokeWidth="10"/>
        <circle cx={cx} cy={cy} r={r} fill="none"
          stroke={color} strokeWidth="10"
          strokeDasharray={`${dash} ${circ-dash}`}
          strokeDashoffset={circ*0.25}
          strokeLinecap="round"/>
        <text x={cx} y={cy-4}  textAnchor="middle" fontSize="13" fontWeight="900" fill="#0f0629">{Math.round(pct)}%</text>
        <text x={cx} y={cy+10} textAnchor="middle" fontSize="7"  fontWeight="700" fill="#9ca3af" letterSpacing="0.3">{label}</text>
      </svg>
      {sub&&<p className={styles.ringSub}>{sub}</p>}
    </div>
  );
}

/* ── Stacked bar ── */
function StackedBar({data}){
  const total=data?.reduce((s,d)=>s+(d.count||0),0)||0;
  if(!total)return null;
  return(
    <div className={styles.stackedBar}>
      {data.map((d,i)=>{
        const key=d.status||d.name;
        const color=STATUS_META[key]?.color||"#a78bfa";
        return(
          <div key={i} className={styles.stackedSeg} title={`${key}: ${d.count}`}
            style={{width:`${(d.count/total)*100}%`,background:color}}/>
        );
      })}
    </div>
  );
}

/* ── Empty chart ── */
function EmptyChart({icon:Icon=Activity,msg="No data for this period"}){
  return(
    <div className={styles.emptyChart}>
      <Icon size={30} className={styles.emptyChartIcon}/><p>{msg}</p>
    </div>
  );
}

/* ── Section heading ── */
function SectionHeading({icon:Icon,title,subtitle,accent,index}){
  return(
    <div className={styles.sectionHeading}>
      <div className={styles.sectionHeadingLeft}>
        <div className={styles.sectionHeadingIcon}
          style={{background:`${accent}12`,color:accent,borderColor:`${accent}25`}}>
          <Icon size={17}/>
        </div>
        <div>
          <h2 className={styles.sectionHeadingText}>{title}</h2>
          {subtitle&&<p className={styles.sectionHeadingSub}>{subtitle}</p>}
        </div>
      </div>
      <span className={styles.sectionIndex}>{String(index).padStart(2,"0")}</span>
    </div>
  );
}

/* ── Chart card ── */
function ChartCard({title,sub,accent,children,extra}){
  return(
    <div className={styles.chartCard}>
      <div className={styles.chartCardHeader}>
        <div>
          <h3 className={styles.chartCardTitle}>{title}</h3>
          {sub&&<span className={styles.chartCardSub}>{sub}</span>}
        </div>
        <div className={styles.chartCardRight}>
          {extra}
          {accent&&<div className={styles.chartAccentBar} style={{background:accent}}/>}
        </div>
      </div>
      {children}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════════════ */
export default function ReportsPage(){
  const router=useRouter();
  const [period,   setPeriod]   =useState("month");
  const [analytics,setAnalytics]=useState(null);
  const [company,  setCompany]  =useState(null);
  const [loading,  setLoading]  =useState(true);
  const [fetching, setFetching] =useState(false);
  const [toast,    setToast]    =useState(null);
  const [exporting,setExporting]=useState(null);
  const timerRef=useRef(null);

  const showToast=useCallback((msg,type="success")=>{
    if(timerRef.current)clearTimeout(timerRef.current);
    setToast({msg,type});
    timerRef.current=setTimeout(()=>setToast(null),4000);
  },[]);

  const loadAnalytics=useCallback(async(p=period,silent=false)=>{
    const token=localStorage.getItem("token");
    if(!token){router.replace("/auth/login");return;}
    if(!silent)setLoading(true);else setFetching(true);
    try{
      const res=await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/exports/analytics?period=${p}`,
        {headers:{Authorization:`Bearer ${token}`}}
      );
      if(!res.ok)throw new Error();
      setAnalytics(await res.json());
    }catch{showToast("Failed to load analytics.","error");}
    finally{setLoading(false);setFetching(false);}
  },[router,showToast,period]);

  useEffect(()=>{
    const s=localStorage.getItem("company");
    if(s){try{setCompany(JSON.parse(s));}catch{}}
    loadAnalytics(period);
    return()=>{if(timerRef.current)clearTimeout(timerRef.current);};
  },[]);// eslint-disable-line

  const handlePeriodChange=p=>{setPeriod(p);loadAnalytics(p,true);};

  const handleExport=async type=>{
    const map={
      visitors:{endpoint:"/api/exports/visitors",            label:"Visitor Records"},
      bookings:{endpoint:"/api/exports/conference-bookings", label:"Conference Bookings"},
      all:     {endpoint:"/api/exports/all",                 label:"Complete Report"},
    };
    const{endpoint,label}=map[type]||{};
    if(!endpoint)return;
    try{
      setExporting(type);
      const res=await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}${endpoint}?period=${period}`,
        {headers:{Authorization:`Bearer ${localStorage.getItem("token")}`}}
      );
      if(!res.ok)throw new Error();
      const blob=await res.blob();
      const cd=res.headers.get("content-disposition");
      let filename=`${label.replace(/\s+/g,"-")}-${period}-${Date.now()}.xlsx`;
      if(cd){const m=cd.match(/filename="(.+)"/);if(m)filename=m[1];}
      const url=URL.createObjectURL(blob);
      const a=document.createElement("a");
      a.href=url;a.download=filename;a.click();
      URL.revokeObjectURL(url);
      showToast(`${label} (${period}) exported.`);
    }catch{showToast("Export failed.","error");}
    finally{setExporting(null);}
  };

  if(loading)return(
    <div className={styles.loadingScreen}>
      <div className={styles.loadingSpinner}/>
      <p className={styles.loadingText}>Loading analytics…</p>
    </div>
  );

  const v=analytics?.visitors||{};
  const b=analytics?.bookings ||{};
  const pl=PERIODS.find(p=>p.key===period)?.label||"Month";
  const vTotal=v.total||0;
  const bTotal=b.total||0;
  const checkoutPct=vTotal>0?Math.round(((vTotal-(v.active||0))/vTotal)*100):0;
  const completePct=bTotal>0?Math.round(((b.completed||0)/bTotal)*100):0;
  const cancelPct  =bTotal>0?Math.round(((b.cancelled ||0)/bTotal)*100):0;

  return(
    <div className={styles.page}>
      <Toast toast={toast} onDismiss={()=>setToast(null)}/>

      {/* HEADER */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <button className={styles.backBtn} onClick={()=>router.push("/home")}>
            <ArrowLeft size={15}/><span>Back</span>
          </button>
          <div className={styles.headerDivider}/>
          <div className={styles.headerBrand}>
            <span className={styles.headerTitle}>{company?.name||"Dashboard"}</span>
            <span className={styles.headerSubtitle}>Analytics &amp; Reports</span>
          </div>
        </div>
        <button className={styles.refreshBtn} onClick={()=>loadAnalytics(period,true)} disabled={fetching}>
          <RefreshCw size={14} className={fetching?styles.spinning:""}/>
          <span>{fetching?"Updating…":"Refresh"}</span>
        </button>
      </header>

      {/* HERO */}
      <div className={styles.hero}>
        <div className={styles.heroInner}>
          {/* Left — pill + title + subtitle */}
          <div className={styles.heroContent}>
            <div className={styles.heroPill}>
              <span className={styles.heroPillDot}/>
              Live data · {pl}
              {fetching&&<span className={styles.heroPillSpinner}/>}
            </div>
            <h1 className={styles.heroTitle}>Visitor &amp; Conference <span>Analytics</span></h1>
            <p className={styles.heroSub}>Unified intelligence across visitor management and room bookings</p>
          </div>
          {/* Right — stats strip */}
          <div className={styles.heroStats}>
            {[
              {val:v.total,   lbl:"Total Visitors"},
              {val:v.today,   lbl:"Today"},
              {val:v.active,  lbl:"Inside Now"},
              {val:b.total,   lbl:"Bookings"},
              {val:b.upcoming,lbl:"Upcoming"},
            ].map((s,i)=>(
              <div key={i} className={styles.heroStat}>
                {i>0&&<div className={styles.heroStatDivider}/>}
                <span className={styles.heroStatVal}>{s.val??"—"}</span>
                <span className={styles.heroStatLabel}>{s.lbl}</span>
              </div>
            ))}
          </div>
        </div>
        <div className={styles.heroOrb1} aria-hidden/><div className={styles.heroOrb2} aria-hidden/>
        <div className={styles.heroGrid} aria-hidden/>
      </div>

      {/* PERIOD */}
      <div className={styles.periodWrap}>
        <PeriodSelector value={period} onChange={handlePeriodChange}/>
        <span className={styles.periodNote}>{fetching?"Updating…":`Showing: ${pl}`}</span>
      </div>

      {/* BODY */}
      <div className={styles.scrollBody}>
        <div className={styles.content}>

          {/* ══ 01 VISITOR ANALYTICS ══ */}
          <section className={styles.section}>
            <SectionHeading icon={Users} title="Visitor Analytics"
              subtitle={`Activity, trends & breakdown — ${pl}`} accent="#7c3aed" index={1}/>

            <div className={styles.kpiGrid}>
              <KpiCard label="Total Visitors"   value={v.total}       prev={v.prevTotal} icon={Users}       accent="#7c3aed" loading={fetching}/>
              <KpiCard label="Inside Now"        value={v.active}                          icon={UserCheck}   accent="#f59e0b" loading={fetching}/>
              <KpiCard label="Today's Arrivals"  value={v.today}                           icon={TrendingUp}  accent="#10b981" loading={fetching}/>
              <KpiCard label="Passes Issued"     value={v.passIssued}                      icon={CheckCircle} accent="#6366f1" loading={fetching}/>
            </div>

            {/* Bar + Donut */}
            <div className={styles.chartRow}>
              <ChartCard title={`Visitor Trend — ${pl}`} sub="Check-ins over selected period" accent="#7c3aed"
                extra={vTotal>0&&<span className={styles.peakChip} style={{"--pc":"#7c3aed"}}>
                  <strong>{Math.max(...(v.dailyTrend||[]).map(d=>d.count),0)}</strong> PEAK
                </span>}>
                <SvgBarChart data={v.dailyTrend||[]} color="#7c3aed" color2="#a78bfa"/>
              </ChartCard>
              <ChartCard title="Visit Status" sub="Distribution for this period">
                <SvgDonut data={(v.visitStatusBreakdown||[]).map(d=>({...d}))}/>
                <StackedBar data={v.visitStatusBreakdown||[]}/>
              </ChartCard>
            </div>

            {/* Line + Heatmap */}
            <div className={styles.chartRow}>
              <ChartCard title="Visitor Trend — Area View" sub="Smooth arrivals curve" accent="#6366f1">
                <SvgLineChart data={v.dailyTrend||[]} color="#6366f1"/>
              </ChartCard>
              <ChartCard title="Peak Check-in Hours" sub="Busiest times of day (IST)">
                <HeatmapChart data={v.hourlyDistribution||[]} color="#7c3aed"/>
              </ChartCard>
            </div>

            {/* DoW + Rings */}
            <div className={styles.chartRow}>
              <ChartCard title="Activity by Day of Week" sub="Which days see the most visitors">
                <DowChart data={v.dowDistribution||[]}/>
              </ChartCard>
              <ChartCard title="Visitor Metrics" sub="Key rates for this period">
                <div className={styles.ringGrid}>
                  <ProgressRing value={checkoutPct} max={100} color="#7c3aed" label="CHECKOUT" sub="Checked out"/>
                  <ProgressRing value={v.passIssued||0} max={vTotal||1} color="#6366f1" label="PASS RATE" sub="Pass issued"/>
                  <ProgressRing value={v.active||0} max={vTotal||1} color="#f59e0b" label="INSIDE" sub="Still inside"/>
                </div>
              </ChartCard>
            </div>

            {/* Top lists */}
            <div className={styles.twoCol}>
              <ChartCard title="Top Employees Visited" sub="Ranked by visitor count">
                <HBarList data={v.topEmployees||[]} color="linear-gradient(90deg,#7c3aed,#a78bfa)"/>
              </ChartCard>
              <ChartCard title="Visit Purposes" sub="Most common reasons">
                <HBarList data={v.topPurposes||[]} color="linear-gradient(90deg,#6366f1,#a5b4fc)"/>
              </ChartCard>
            </div>
          </section>

          {/* ══ 02 CONFERENCE ANALYTICS ══ */}
          <section className={styles.section}>
            <SectionHeading icon={CalendarDays} title="Conference Analytics"
              subtitle={`Room utilisation & booking patterns — ${pl}`} accent="#0ea5e9" index={2}/>

            <div className={styles.kpiGrid}>
              <KpiCard label="Total Bookings" value={b.total}     prev={b.prevTotal} icon={CalendarDays} accent="#0ea5e9" loading={fetching}/>
              <KpiCard label="Upcoming"       value={b.upcoming}                      icon={Clock}        accent="#f59e0b" loading={fetching}/>
              <KpiCard label="Completed"      value={b.completed}                     icon={CheckCircle}  accent="#10b981" loading={fetching}/>
              <KpiCard label="Cancelled"      value={b.cancelled}                     icon={XCircle}      accent="#ef4444" loading={fetching}/>
            </div>

            {b.avgDurationMinutes>0&&(
              <div className={styles.durationBanner}>
                <Timer size={15}/>
                <span>Avg booking duration: <strong>{b.avgDurationMinutes} min</strong> this {period}</span>
              </div>
            )}

            {/* Bar + Donut */}
            <div className={styles.chartRow}>
              <ChartCard title={`Booking Trend — ${pl}`} sub="Bookings over selected period" accent="#0ea5e9"
                extra={bTotal>0&&<span className={styles.peakChip} style={{"--pc":"#0ea5e9"}}>
                  <strong>{Math.max(...(b.dailyTrend||[]).map(d=>d.count),0)}</strong> PEAK
                </span>}>
                <SvgBarChart data={b.dailyTrend||[]} color="#0ea5e9" color2="#7dd3fc"/>
              </ChartCard>
              <ChartCard title="Booking Status" sub="Distribution for this period">
                <SvgDonut data={(b.statusBreakdown||[]).map(d=>({...d}))}/>
                <StackedBar data={b.statusBreakdown||[]}/>
              </ChartCard>
            </div>

            {/* Line + DoW */}
            <div className={styles.chartRow}>
              <ChartCard title="Booking Trend — Area View" sub="Smooth bookings curve" accent="#06b6d4">
                <SvgLineChart data={b.dailyTrend||[]} color="#06b6d4"/>
              </ChartCard>
              <ChartCard title="Bookings by Day of Week" sub="Which days rooms get booked">
                <DowChart data={b.dowDistribution||[]}/>
              </ChartCard>
            </div>

            {/* Rings + Top rooms */}
            <div className={styles.chartRow}>
              <ChartCard title="Performance Rates" sub="Completion and cancellation breakdown">
                <div className={styles.ringGrid}>
                  <ProgressRing value={completePct} max={100} color="#10b981" label="COMPLETED" sub="Completed"/>
                  <ProgressRing value={cancelPct}   max={100} color="#ef4444" label="CANCELLED"  sub="Cancelled"/>
                  <ProgressRing value={b.upcoming||0} max={bTotal||1} color="#0ea5e9" label="UPCOMING" sub="Upcoming"/>
                </div>
              </ChartCard>
              <ChartCard title="Most Booked Rooms" sub="Ranked by booking count">
                <HBarList data={b.topRooms||[]} color="linear-gradient(90deg,#0ea5e9,#7dd3fc)"/>
              </ChartCard>
            </div>

            {/* Dept + Completion donut */}
            <div className={styles.twoCol}>
              <ChartCard title="Bookings by Department" sub="Top departments">
                <HBarList data={b.byDepartment||[]} color="linear-gradient(90deg,#06b6d4,#67e8f9)"/>
              </ChartCard>
              <ChartCard title="Completion Breakdown" sub="Completed vs cancelled bookings">
                <SvgDonut data={(b.statusBreakdown||[]).filter(d=>["COMPLETED","CANCELLED","BOOKED"].includes(d.status))}/>
              </ChartCard>
            </div>
          </section>

          {/* ══ EXPORT ══ */}
          <section className={styles.exportSection}>
            <div className={styles.exportHeader}>
              <div className={styles.exportIconWrap}><FileDown size={22}/></div>
              <div>
                <h3 className={styles.exportTitle}>Export Reports</h3>
                <p className={styles.exportSub}>Download Excel workbooks scoped to: <strong>{pl}</strong></p>
              </div>
            </div>
            <div className={styles.exportCards}>
              {[
                {type:"visitors",icon:<Users size={20}/>,    color:"#7c3aed",label:"Visitor Records",    desc:"Check-in/out, pass status and visitor details"},
                {type:"bookings",icon:<Calendar size={20}/>,color:"#0ea5e9",label:"Conference Bookings",desc:"Room schedules, departments, hosts and status"},
              ].map(e=>(
                <div key={e.type} className={styles.exportCard}>
                  <div className={styles.exportCardTop}>
                    <div className={styles.exportCardIcon} style={{background:`${e.color}12`,color:e.color}}>{e.icon}</div>
                    <span className={styles.exportCardBadge} style={{background:`${e.color}10`,color:e.color}}>.xlsx</span>
                  </div>
                  <p className={styles.exportCardTitle}>{e.label}</p>
                  <p className={styles.exportCardSub}>{e.desc}</p>
                  <button className={styles.exportBtn} style={{"--eb":e.color}}
                    onClick={()=>handleExport(e.type)} disabled={!!exporting}>
                    {exporting===e.type
                      ?<><RefreshCw size={13} className={styles.spinning}/> Exporting…</>
                      :<><Download size={13}/> Download {pl}</>}
                  </button>
                </div>
              ))}
              <div className={`${styles.exportCard} ${styles.exportCardFull}`}>
                <div className={styles.exportCardTop}>
                  <div className={styles.exportCardIcon} style={{background:"rgba(255,255,255,0.12)",color:"#fbbf24"}}><Layers size={20}/></div>
                  <span className={styles.exportCardBadge} style={{background:"rgba(251,191,36,0.15)",color:"#fbbf24"}}>Multi-sheet</span>
                </div>
                <p className={styles.exportCardTitle}>Complete Report</p>
                <p className={styles.exportCardSub}>Visitors + bookings in one workbook — {pl}</p>
                <button className={`${styles.exportBtn} ${styles.exportBtnFull}`}
                  onClick={()=>handleExport("all")} disabled={!!exporting}>
                  {exporting==="all"
                    ?<><RefreshCw size={13} className={styles.spinning}/> Exporting…</>
                    :<><Download size={13}/> Download All ({pl})</>}
                </button>
              </div>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}
