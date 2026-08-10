"use client";

import { usePathname } from "next/navigation";

export function SiteHeader() {
  const pathname = usePathname();
  return <header className="topbar app-header"><a className="brand" href="/"><img src="/appbk-logo.png" alt="appbk" /><span>appbk</span></a><nav aria-label="主导航"><a className={pathname === "/" ? "active" : ""} href="/">首页</a><a className={pathname.startsWith("/rankings") ? "active" : ""} href="/rankings">数据大盘</a><a className={pathname.startsWith("/apps") ? "active" : ""} href="/rankings">App 分析</a><a href="/#agent">Agent</a></nav><a className="header-action" href="/">搜索 App</a></header>;
}
