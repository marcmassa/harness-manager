import * as React from 'react';

export const PanelActionIcon = ({ children }: { children: React.ReactNode }) => (
    <svg
        viewBox="0 0 16 16"
        width="14"
        height="14"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
    >
        {children}
    </svg>
);

export const IconChevronLeft = () => (
    <PanelActionIcon>
        <path d="M10.5 3.5L6 8l4.5 4.5" />
    </PanelActionIcon>
);

export const IconChevronRight = () => (
    <PanelActionIcon>
        <path d="M5.5 3.5L10 8l-4.5 4.5" />
    </PanelActionIcon>
);

export const IconEdit = () => (
    <PanelActionIcon>
        <path d="M3 13l2.8-.7L12.6 5.5 10.5 3.4 3.7 10.2z" />
        <path d="M9.9 4l2.1 2.1" />
    </PanelActionIcon>
);

export const IconTrash = () => (
    <PanelActionIcon>
        <path d="M2.8 4.5h10.4" />
        <path d="M6.2 4.5V3.2h3.6v1.3" />
        <path d="M4.5 4.5l.8 8.3h5.4l.8-8.3" />
        <path d="M6.7 7v4.2" />
        <path d="M9.3 7v4.2" />
    </PanelActionIcon>
);

export const IconClose = () => (
    <PanelActionIcon>
        <path d="M4 4l8 8" />
        <path d="M12 4L4 12" />
    </PanelActionIcon>
);

export const IconGear = () => (
    <svg
        viewBox="0 0 16 16"
        width="14"
        height="14"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
    >
        <circle cx="8" cy="8" r="2" />
        <path d="M8 1v2" />
        <path d="M8 13v2" />
        <path d="M2 8H0" />
        <path d="M16 8h-2" />
        <path d="M4.5 4.5l1 1" />
        <path d="M10.5 10.5l1 1" />
        <path d="M11.5 4.5l-1 1" />
        <path d="M5.5 10.5l-1 1" />
    </svg>
);

export const IconExpand = () => (
    <svg
        viewBox="0 0 16 16"
        width="14"
        height="14"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
    >
        <path d="M2 9v5h5" />
        <path d="M14 7V2H9" />
        <path d="M2 14l5.5-5.5" />
        <path d="M14 2L8.5 7.5" />
    </svg>
);

export const PanelActionButton = ({
    title,
    onClick,
    children,
    danger = false,
    disabled = false,
}: {
    title: string;
    onClick: () => void;
    children: React.ReactNode;
    danger?: boolean;
    disabled?: boolean;
}) => (
    <button
        type="button"
        className={`harness-panel-action-button${danger ? ' harness-panel-action-button--danger' : ''}`}
        title={title}
        aria-label={title}
        onClick={onClick}
        disabled={disabled}
    >
        {children}
    </button>
);
