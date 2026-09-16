import React from "react";

// Простая узнаваемая иконка автобетоносмесителя (миксера).
// Используется вместо надписи "PRO" в шапке и на экране выбора роли.
export default function MixerIcon({ className = "w-5 h-5" }) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <rect x="3" y="26" width="11" height="10" rx="1.5" fill="currentColor" />
      <rect x="5.5" y="28.5" width="4.5" height="4" rx="0.5" fill="white" fillOpacity="0.35" />
      <rect x="3" y="34" width="31" height="4" rx="1" fill="currentColor" />
      <g transform="rotate(-28 28 20)">
        <rect x="16" y="9" width="25" height="17" rx="8.5" fill="currentColor" />
        <rect x="20.5" y="9" width="3" height="17" fill="white" fillOpacity="0.35" />
        <rect x="28" y="9" width="3" height="17" fill="white" fillOpacity="0.35" />
        <rect x="35.5" y="9" width="3" height="17" fill="white" fillOpacity="0.35" />
      </g>
      <circle cx="10.5" cy="40" r="3.6" fill="currentColor" />
      <circle cx="27" cy="40" r="3.6" fill="currentColor" />
    </svg>
  );
}
