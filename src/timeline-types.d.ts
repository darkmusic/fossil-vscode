/*---------------------------------------------------------------------------------------------
 * Timeline API (proposed) — not yet in @types/vscode for this engine version.
 *--------------------------------------------------------------------------------------------*/

import 'vscode';

declare module 'vscode' {
    export class TimelineItem {
        timestamp: number;
        label: string;
        id?: string;
        iconPath?: Uri | { light: Uri; dark: Uri } | ThemeIcon;
        description?: string;
        detail?: string;
        command?: Command;
        contextValue?: string;
        constructor(label: string, timestamp: number);
    }

    export interface TimelineChangeEvent {
        readonly uri?: Uri;
        readonly reset?: boolean;
    }

    export interface Timeline {
        readonly paging?: {
            readonly cursor: string | undefined;
        };
        readonly items: readonly TimelineItem[];
    }

    export interface TimelineOptions {
        cursor?: string;
        limit?: number | { timestamp: number; id?: string };
    }

    export interface TimelineProvider {
        onDidChange?: Event<TimelineChangeEvent | undefined>;
        readonly id: string;
        readonly label: string;
        provideTimeline(
            uri: Uri,
            options: TimelineOptions,
            token: CancellationToken
        ): ProviderResult<Timeline>;
    }

    export namespace workspace {
        function registerTimelineProvider(
            scheme: string | string[],
            provider: TimelineProvider
        ): Disposable;
    }
}
