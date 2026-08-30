import { Component, Suspense, lazy, useState } from "react";
import { useAuthStore } from "../../stores/authStore";
const CostSimApp = lazy(() => import("costsim/App"));
class EB extends Component { constructor(p) { super(p); this.state={e:false}; }
  static getDerivedStateFromError(){ return {e:true}; }
  componentDidCatch(err){ console.error("[CostSim]",err); this.props.onError(); }
  render(){ return this.state.e ? null : this.props.children; }
}
export function CostSimLoader(){
  const [err,setErr]=useState(false);
  const user=useAuthStore(s=>s.user);
  const getToken=()=>useAuthStore.getState().accessToken;
  if(err)return <div className="p-8 text-sm text-gray-500 text-center">CostSimulator unavailable. <button onClick={()=>window.location.reload()} className="text-indigo-600">Refresh</button></div>;
  return <Suspense fallback={<div className="p-8 text-gray-300 animate-pulse">Loading…</div>}><EB onError={()=>setErr(true)}><CostSimApp apiBaseUrl={import.meta.env.VITE_API_URL??""} basePath="/costsim" isPlatformAdmin={user?.platformRole==="platform_admin"} getAccessToken={getToken}/></EB></Suspense>;
}
