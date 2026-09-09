"use client";

import { useState } from "react";
import Link from "next/link";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

const SIDEBAR_TRANSITION = "transition-all duration-300 ease-in-out";

const EXPLORE_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]">
    <circle cx="12" cy="12" r="9" />
    <path d="M15 9l-2 6-6 2 2-6 6-2z" />
  </svg>
);

const NEWS_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]">
    <path d="M4 6h16v12H4zM7 10h6M7 14h10" />
  </svg>
);

const ADVERTISE_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]">
    <rect x="3" y="5" width="14" height="9" rx="1.5" />
    <path d="M8 18l1.5-4M14 18l-1.5-4" />
    <path d="M17 8l4-2v7l-4-2" />
  </svg>
);

const ENQUIRIES_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]">
    <path d="M4 6h16v12H4zM4 7l8 6 8-6" />
  </svg>
);

type NavItem = { label: string; icon: React.ReactNode; href?: string; action?: "explore" | "news" };

type SidebarProps = {
  onExplore: () => void;
  onOpenNews: () => void;
  /** Ad placement tools and the admin-only pages. */
  isAdmin?: boolean;
  /** Public navigation is an on-demand drawer so the map stays full-screen. */
  publicMode?: boolean;
  onPlacePandal?: () => void;
  onPlaceBillboard?: () => void;
  onPlaceAircraft?: () => void;
  onPlaceRail?: () => void;
  /** Mobile only. Ignored at the lg breakpoint, where the rail is always visible. */
  mobileOpen: boolean;
  onMobileClose: () => void;
};

/**
 * The public build has no account, no saved lists and no leaderboard —
 * there is nothing to sign in for in v1 — so the visitor's navigation is
 * three items and lives entirely in the mobile drawer. The persistent
 * desktop rail is an admin workspace.
 */
export default function Sidebar({
  onExplore,
  onOpenNews,
  isAdmin = false,
  publicMode = false,
  onPlacePandal,
  onPlaceBillboard,
  onPlaceAircraft,
  onPlaceRail,
  mobileOpen,
  onMobileClose,
}: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  const navItems: NavItem[] = isAdmin
    ? [
        { label: "Preview", icon: EXPLORE_ICON, action: "explore" },
        { label: "News", icon: NEWS_ICON, action: "news" },
        { label: "Ad enquiries", icon: ENQUIRIES_ICON, href: "/admin/ad-enquiries" },
        { label: "Billboards", icon: ADVERTISE_ICON, href: "/admin/billboards" },
      ]
    : [
        { label: "Explore map", icon: EXPLORE_ICON, action: "explore" },
        { label: "News", icon: NEWS_ICON, action: "news" },
        { label: "Advertise", icon: ADVERTISE_ICON, href: "/advertise" },
      ];

  function renderBrand(forceExpanded: boolean) {
    const isCollapsed = collapsed && !forceExpanded;
    return (
      <div className="mb-5 flex items-center gap-2 px-0.5">
        <span className="brand-mark flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white shadow-sm">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]">
            <path d="M12 21s-7-5.2-7-11a7 7 0 0 1 14 0c0 5.8-7 11-7 11z" />
            <circle cx="12" cy="10" r="2.5" />
          </svg>
        </span>
        <div className={`min-w-0 flex-1 overflow-hidden ${SIDEBAR_TRANSITION} ${isCollapsed ? "max-w-0 opacity-0" : "max-w-[160px] opacity-100"}`}>
          <div className="truncate text-[15px] font-semibold whitespace-nowrap tracking-tight text-neutral-100">
            WhatsNearYou
          </div>
        </div>
        {!forceExpanded && collapseToggleButton()}
      </div>
    );
  }

  function renderNav(forceExpanded: boolean) {
    const isCollapsed = collapsed && !forceExpanded;
    return (
      <nav className="flex flex-col gap-0.5">
        {navItems.map((item) => {
          const className = `group flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13.5px] font-medium text-neutral-400 hover:bg-white/10 hover:text-neutral-100 ${SIDEBAR_TRANSITION}`;
          const content = (
            <>
              <span className="shrink-0">{item.icon}</span>
              <span className={`overflow-hidden whitespace-nowrap ${SIDEBAR_TRANSITION} ${isCollapsed ? "max-w-0 opacity-0" : "max-w-[160px] opacity-100"}`}>
                {item.label}
              </span>
            </>
          );
          if (item.href) {
            return (
              <Link key={item.label} href={item.href} title={isCollapsed ? item.label : undefined} onClick={onMobileClose} className={className}>
                {content}
              </Link>
            );
          }
          return (
            <button
              key={item.label}
              title={isCollapsed ? item.label : undefined}
              onClick={() => {
                if (item.action === "news") onOpenNews();
                else onExplore();
                onMobileClose();
              }}
              className={className}
            >
              {content}
            </button>
          );
        })}

        {isAdmin && onPlaceBillboard && onPlaceAircraft && onPlaceRail && (
          <div className="mt-4 border-t border-white/10 pt-3">
            <div className={`mb-1.5 px-3 text-[10px] font-semibold tracking-[0.16em] text-neutral-500 uppercase ${isCollapsed ? "sr-only" : ""}`}>
              Place on map
            </div>
            {onPlacePandal && (
              <PlaceButton label="Pin a pandal" glyph="📍" collapsed={isCollapsed} onClick={() => { onPlacePandal(); onMobileClose(); }} />
            )}
            <PlaceButton label="Place billboard" glyph="📢" collapsed={isCollapsed} onClick={() => { onPlaceBillboard(); onMobileClose(); }} />
            <PlaceButton label="Place rail ad" glyph="▦" collapsed={isCollapsed} onClick={() => { onPlaceRail(); onMobileClose(); }} />
            <PlaceButton label="Aircraft banner" glyph="✈" collapsed={isCollapsed} onClick={() => { onPlaceAircraft(); onMobileClose(); }} />
          </div>
        )}
      </nav>
    );
  }

  // Fixed-height row always — only the text inside crossfades via
  // max-width + opacity. Collapsing the row's own height shifted
  // everything above it during the animation instead of fading in place.
  function renderFooter(forceExpanded: boolean) {
    const isCollapsed = collapsed && !forceExpanded;
    return (
      <div className="flex justify-center overflow-hidden pt-3">
        <span className={`text-center text-[10px] whitespace-nowrap text-neutral-400 ${SIDEBAR_TRANSITION} ${isCollapsed ? "max-w-0 opacity-0" : "max-w-[200px] opacity-100"}`}>
          Made with ♥ for Hyderabad
        </span>
      </div>
    );
  }

  function collapseToggleButton() {
    return (
      <button
        onClick={() => setCollapsed((v) => !v)}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-neutral-400 hover:bg-white/10 hover:text-neutral-100"
      >
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={`h-3.5 w-3.5 transition-transform duration-300 ease-in-out ${collapsed ? "rotate-180" : ""}`}>
          <path d="M12 5l-5 5 5 5" />
        </svg>
      </button>
    );
  }

  return (
    <>
      {/* Desktop rail — admin only. The collapse toggle sits inside the
          panel rather than floating half outside its rounded bounds,
          which read as a seam between this panel and the map beside it.
          Every piece of content stays mounted across collapse/expand and
          animates on the same duration/easing as the rail itself;
          swapping components in and out mid-animation is what caused a
          jump here originally. */}
      {!publicMode && (
        <div className={`relative hidden h-full shrink-0 lg:block ${SIDEBAR_TRANSITION} ${collapsed ? "w-[96px]" : "w-64"}`}>
          <aside className="panel-elevated flex h-full w-full flex-col gap-1 overflow-y-auto overflow-x-hidden rounded-3xl p-3.5">
            {renderBrand(false)}
            {renderNav(false)}
            <div className="mt-auto flex flex-col gap-2 pt-4">{renderFooter(false)}</div>
          </aside>
        </div>
      )}

      {/* Mobile drawer — 256px, matching the expanded desktop rail. The
          same navigation should not be two different widths depending on
          how it opened. */}
      <Sheet open={mobileOpen} onOpenChange={(open) => !open && onMobileClose()}>
        <SheetContent side="left" className={`navigation-drawer flex w-64 max-w-[80vw] flex-col gap-1 p-4 ${publicMode ? "" : "lg:hidden"}`}>
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          {renderBrand(true)}
          {renderNav(true)}
          <div className="mt-auto flex flex-col gap-2 pt-4">{renderFooter(true)}</div>
        </SheetContent>
      </Sheet>
    </>
  );
}

function PlaceButton({
  label,
  glyph,
  collapsed,
  onClick,
}: {
  label: string;
  glyph: string;
  collapsed: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={collapsed ? label : undefined}
      className="group flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13.5px] font-medium text-neutral-400 transition-colors hover:bg-white/10 hover:text-neutral-100"
    >
      <span className="shrink-0" aria-hidden="true">{glyph}</span>
      <span className={`overflow-hidden whitespace-nowrap ${SIDEBAR_TRANSITION} ${collapsed ? "max-w-0 opacity-0" : "max-w-[160px] opacity-100"}`}>
        {label}
      </span>
    </button>
  );
}
