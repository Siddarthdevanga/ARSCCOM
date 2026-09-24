"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Download, Users, CalendarDays, TrendingUp, TrendingDown,
  CheckCircle, XCircle, Clock, AlertCircle, Activity, BarChart2,
  FileDown, RefreshCw, UserCheck, Layers, Calendar, Timer, QrCode,
} from "lucide-react";
import {
  SvgBarChart, SvgLineChart, SvgDonut, HBarList, HeatmapChart, DowChart,
  StackedBar, ProgressRing, EmptyChart, SubcategoryChart, SERIES,
} from "./charts";
import styles from "./style.module.css";

const PERIODS = [
  { key:"today",   label:"Today"   },
  { key:"week",    label:"Week"    },
  { key:"month",   label:"Month"   },
  { key:"quarter", label:"Quarter" },
  { key:"year",    label:"Year"    },
];
const DOW_LABELS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const LIVE_INTERVAL_MS = 30000;
const STATUS_META = {
  pending:     { label:"Pending",     color:"#f59e0b" },
  accepted:    { label:"Accepted",    color:"#10b981" },
  declined:    { label:"Declined",    color:"#ef4444" },
  checked_in:  { label:"Checked In",  color:"#6366f1" },
  checked_out:      { label:"Checked Out",      color:"#232327" },
  auto_checked_out: { label:"Auto Checked Out", color:"#6b7280" },
  BOOKED:      { label:"Booked",      color:"#1d1d21" },
  CANCELLED:   { label:"Cancelled",   color:"#ef4444" },
  COMPLETED:   { label:"Completed",   color:"#10b981" },
  excellent:         { label:"👍 Excellent",         color:"#00a875" },
  good:              { label:"😊 Good",               color:"#2563eb" },
  needs_improvement: { label:"😐 Needs Improvement",  color:"#f59e0b" },
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
  const [currentPlan,setCurrentPlan]=useState(null);
  const [live,setLive]=useState(true);
  const timerRef=useRef(null);

  const showToast=useCallback((msg,type="success")=>{
    if(timerRef.current)clearTimeout(timerRef.current);
    setToast({msg,type});
    timerRef.current=setTimeout(()=>setToast(null),4000);
  },[]);

  const loadAnalytics=useCallback(async(p=period,silent=false)=>{
    if(!localStorage.getItem("company")){router.replace("/login");return;}
    if(!silent)setLoading(true);else setFetching(true);
    try{
      const res=await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/exports/analytics?period=${p}`,
        {credentials:"include"}
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
    fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/subscription/details`,{credentials:"include"})
      .then(r=>r.json())
      .then(d=>{if(d?.PLAN)setCurrentPlan(d.PLAN.toLowerCase());})
      .catch(()=>{});
    return()=>{if(timerRef.current)clearTimeout(timerRef.current);};
  },[]);// eslint-disable-line

  /* Live refresh. Polls only while the tab is visible — a dashboard left
     open in a background tab should not keep hitting the API — and always
     silently, so the page never flashes its loading state. */
  useEffect(()=>{
    if(!live)return;
    const tick=()=>{if(document.visibilityState==="visible")loadAnalytics(period,true);};
    const id=setInterval(tick,LIVE_INTERVAL_MS);
    document.addEventListener("visibilitychange",tick);
    return()=>{clearInterval(id);document.removeEventListener("visibilitychange",tick);};
  },[live,period,loadAnalytics]);

  const isBusinessPlan = currentPlan==="business";

  const handlePeriodChange=p=>{setPeriod(p);loadAnalytics(p,true);};

  const handleExport=async type=>{
    const map={
      visitors:{endpoint:"/api/exports/visitors",            label:"Visitor Records"},
      bookings:{endpoint:"/api/exports/conference-bookings", label:"Conference Bookings"},
      smartForms:{endpoint:"/api/exports/smart-forms",       label:"Smart Forms Responses"},
      all:     {endpoint:"/api/exports/all",                 label:"Complete Report"},
    };
    const{endpoint,label}=map[type]||{};
    if(!endpoint)return;
    try{
      setExporting(type);
      const res=await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}${endpoint}?period=${period}`,
        {credentials:"include"}
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
          <div className={styles.headerBrand}>
            <span className={styles.headerTitle}>{company?.name||"Dashboard"}</span>
            <span className={styles.headerSubtitle}>Analytics &amp; Reports</span>
          </div>
        </div>
        <div className={styles.headerActions}>
          {/* Live is on by default but must be switchable off: auto-refresh
              mid-read is disorienting when someone is studying a number. */}
          <button
            className={`${styles.liveToggle} ${live?styles.liveOn:""}`}
            onClick={()=>setLive(l=>!l)}
            aria-pressed={live}
            title={live?`Auto-refreshing every ${LIVE_INTERVAL_MS/1000}s`:"Auto-refresh paused"}
          >
            <span className={styles.liveDot}/>
            <span>{live?"Live":"Paused"}</span>
          </button>
          <button className={styles.refreshBtn} onClick={()=>loadAnalytics(period,true)} disabled={fetching}>
            <RefreshCw size={14} className={fetching?styles.spinning:""}/>
            <span>{fetching?"Updating…":"Refresh"}</span>
          </button>
          <div className={styles.headerDivider}/>
          <button className={styles.backBtn} onClick={()=>router.push("/home")}>
            <ArrowLeft size={15}/><span>Back</span>
          </button>
        </div>
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
              subtitle={`Activity, trends & breakdown — ${pl}`} accent="#1d1d21" index={1}/>

            <div className={styles.kpiGrid}>
              <KpiCard label="Total Visitors"   value={v.total}       prev={v.prevTotal} icon={Users}       accent="#1d1d21" loading={fetching}/>
              <KpiCard label="Inside Now"        value={v.active}                          icon={UserCheck}   accent="#f59e0b" loading={fetching}/>
              <KpiCard label="Today's Arrivals"  value={v.today}                           icon={TrendingUp}  accent="#10b981" loading={fetching}/>
              <KpiCard label="Passes Issued"     value={v.passIssued}                      icon={CheckCircle} accent="#6366f1" loading={fetching}/>
            </div>

            {/* Bar + Donut */}
            <div className={styles.chartRow}>
              <ChartCard title={`Visitor Trend — ${pl}`} sub="Check-ins over selected period" accent="#1d1d21"
                extra={vTotal>0&&<span className={styles.peakChip} style={{"--pc":"#1d1d21"}}>
                  <strong>{Math.max(...(v.dailyTrend||[]).map(d=>d.count),0)}</strong> PEAK
                </span>}>
                <SvgBarChart data={v.dailyTrend||[]} color={SERIES[0]} color2="#ffc75f"/>
              </ChartCard>
              <ChartCard title="Visit Status" sub="Distribution for this period">
                <SvgDonut data={v.visitStatusBreakdown||[]} meta={STATUS_META}/>
                <StackedBar data={v.visitStatusBreakdown||[]}/>
              </ChartCard>
            </div>

            {/* Feedback (checkout+feedback WhatsApp flow) */}
            <div className={styles.chartRow}>
              <ChartCard title="Visitor Feedback" sub="Ratings received for this period">
                {(v.feedbackBreakdown||[]).length>0 ? (
                  <>
                    <SvgDonut data={(v.feedbackBreakdown||[]).map(d=>({status:d.name,count:d.count}))} meta={STATUS_META}/>
                    <HBarList data={(v.feedbackBreakdown||[]).map(d=>({name:d.name,count:d.count}))} color="linear-gradient(90deg,#f59e0b,#fbbf24)"/>
                  </>
                ) : (
                  <p style={{color:"#9ca3af",fontSize:"0.85rem",textAlign:"center",padding:"2rem 0"}}>No feedback received yet for this period</p>
                )}
              </ChartCard>
              <ChartCard title="Feedback Response Rate" sub={`${v.feedbackResponded||0} of ${v.feedbackEligible||0} replied`}>
                <div className={styles.ringGrid}>
                  <ProgressRing value={v.feedbackResponseRate||0} max={100} color={SERIES[0]} label="RESPONSE RATE" sub="Replied to request"/>
                </div>
              </ChartCard>
            </div>

            {/* Line + Heatmap */}
            <div className={styles.chartRow}>
              <ChartCard title="Visitor Trend — Area View" sub="Smooth arrivals curve" accent="#6366f1">
                <SvgLineChart data={v.dailyTrend||[]} color={SERIES[3]}/>
              </ChartCard>
              <ChartCard title="Peak Check-in Hours" sub="Busiest times of day (IST)">
                <HeatmapChart data={v.hourlyDistribution||[]}/>
              </ChartCard>
            </div>

            {/* DoW + Rings */}
            <div className={styles.chartRow}>
              <ChartCard title="Activity by Day of Week" sub="Which days see the most visitors">
                <DowChart data={v.dowDistribution||[]}/>
              </ChartCard>
              <ChartCard title="Visitor Metrics" sub="Key rates for this period">
                <div className={styles.ringGrid}>
                  <ProgressRing value={checkoutPct} max={100} color={SERIES[2]} label="CHECKOUT" sub="Checked out"/>
                  <ProgressRing value={v.passIssued||0} max={vTotal||1} color={SERIES[3]} label="PASS RATE" sub="Pass issued"/>
                  <ProgressRing value={v.active||0} max={vTotal||1} color={SERIES[0]} label="INSIDE" sub="Still inside"/>
                </div>
              </ChartCard>
            </div>

            {/* Top lists */}
            <div className={styles.twoCol}>
              <ChartCard title="Top Employees Visited" sub="Ranked by visitor count">
                <HBarList data={v.topEmployees||[]}/>
              </ChartCard>
              <ChartCard title="Visit Purposes" sub="Most common reasons">
                <HBarList data={v.topPurposes||[]}/>
              </ChartCard>
            </div>

            {/* Purpose category breakdown — only shown once a company has
                configured custom Purpose of Visit categories in Form Builder */}
            {v.purposeCategoryBreakdown?.length > 0 && (
              <div className={styles.twoCol}>
                <ChartCard title="Purpose Categories" sub="Visits grouped by your custom categories">
                  <HBarList data={v.purposeCategoryBreakdown}/>
                </ChartCard>
                <ChartCard title="Category Breakdown" sub="What each category is actually made of">
                  <SubcategoryChart data={v.purposeSubcategoryBreakdown||[]}/>
                </ChartCard>
              </div>
            )}

          </section>

          {/* ══ 02 CONFERENCE ANALYTICS ══ */}
          {isBusinessPlan ? (
          <section className={styles.section}>
            <SectionHeading icon={CalendarDays} title="Conference Analytics"
              subtitle="Room utilisation & booking patterns" accent="#0ea5e9" index={2}/>
            <div className={styles.upgradeCard}>
              <div className={styles.upgradeCardIcon}><CalendarDays size={26}/></div>
              <h3 className={styles.upgradeCardTitle}>Conference Analytics is an Enterprise feature</h3>
              <p className={styles.upgradeCardText}>
                Your Business plan covers visitor management only. Enterprise adds
                unlimited conference room booking — room scheduling, booking trends,
                most-booked rooms, department usage, and completion &amp; cancellation
                rates — plus the ability to export conference booking reports.
              </p>
              <button className={styles.upgradeCardBtn} onClick={()=>router.push("/subscription")}>
                Upgrade to Enterprise
              </button>
            </div>
          </section>
          ) : (
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
                <SvgBarChart data={b.dailyTrend||[]} color={SERIES[1]} color2="#7dd3fc"/>
              </ChartCard>
              <ChartCard title="Booking Status" sub="Distribution for this period">
                <SvgDonut data={b.statusBreakdown||[]} meta={STATUS_META}/>
                <StackedBar data={b.statusBreakdown||[]} meta={STATUS_META}/>
              </ChartCard>
            </div>

            {/* Line + DoW */}
            <div className={styles.chartRow}>
              <ChartCard title="Booking Trend — Area View" sub="Smooth bookings curve" accent="#06b6d4">
                <SvgLineChart data={b.dailyTrend||[]} color={SERIES[5]}/>
              </ChartCard>
              <ChartCard title="Bookings by Day of Week" sub="Which days rooms get booked">
                <DowChart data={b.dowDistribution||[]}/>
              </ChartCard>
            </div>

            {/* Rings + Top rooms */}
            <div className={styles.chartRow}>
              <ChartCard title="Performance Rates" sub="Completion and cancellation breakdown">
                <div className={styles.ringGrid}>
                  <ProgressRing value={completePct} max={100} color={SERIES[2]} label="COMPLETED" sub="Completed"/>
                  <ProgressRing value={cancelPct}   max={100} color={SERIES[4]} label="CANCELLED"  sub="Cancelled"/>
                  <ProgressRing value={b.upcoming||0} max={bTotal||1} color={SERIES[1]} label="UPCOMING" sub="Upcoming"/>
                </div>
              </ChartCard>
              <ChartCard title="Most Booked Rooms" sub="Ranked by booking count">
                <HBarList data={b.topRooms||[]}/>
              </ChartCard>
            </div>

            {/* Dept + Completion donut */}
            <div className={styles.twoCol}>
              <ChartCard title="Bookings by Department" sub="Top departments">
                <HBarList data={b.byDepartment||[]}/>
              </ChartCard>
              <ChartCard title="Completion Breakdown" sub="Completed vs cancelled bookings">
                <SvgDonut data={(b.statusBreakdown||[]).filter(d=>["COMPLETED","CANCELLED","BOOKED"].includes(d.status))} meta={STATUS_META}/>
              </ChartCard>
            </div>
          </section>
          )}

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
                {type:"visitors",icon:<Users size={20}/>,    color:"#1d1d21",label:"Visitor Records",    desc:"Check-in/out, pass status and visitor details"},
                ...(isBusinessPlan?[]:[{type:"bookings",icon:<Calendar size={20}/>,color:"#0ea5e9",label:"Conference Bookings",desc:"Room schedules, departments, hosts and status"}]),
                {type:"smartForms",icon:<QrCode size={20}/>, color:"#047857",label:"Smart Forms Responses",desc:"All QR-form submissions, tagged by which form"},
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
              {isBusinessPlan && (
                <div className={styles.exportCard}>
                  <div className={styles.exportCardTop}>
                    <div className={styles.exportCardIcon} style={{background:"#0ea5e912",color:"#0ea5e9"}}><Calendar size={20}/></div>
                    <span className={styles.exportCardBadge} style={{background:"#0ea5e910",color:"#0ea5e9"}}>Enterprise</span>
                  </div>
                  <p className={styles.exportCardTitle}>Conference Bookings</p>
                  <p className={styles.exportCardSub}>Room schedules, departments, hosts and status — available on Enterprise</p>
                  <button className={styles.exportBtn} style={{"--eb":"#0ea5e9"}} onClick={()=>router.push("/subscription")}>
                    Upgrade to Enterprise
                  </button>
                </div>
              )}
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
