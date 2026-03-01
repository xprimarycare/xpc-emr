'use client';

import React from 'react';
import { Group, Panel, Separator, Layout } from 'react-resizable-panels';

interface SplitTabLayoutProps {
  leftPanel: React.ReactNode;
  rightPanel: React.ReactNode;
  defaultLayout?: Layout;
  onLayoutChanged?: (layout: Layout) => void;
}

export function SplitTabLayout({
  leftPanel,
  rightPanel,
  defaultLayout,
  onLayoutChanged,
}: SplitTabLayoutProps) {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Group
        orientation="horizontal"
        defaultLayout={defaultLayout}
        onLayoutChanged={onLayoutChanged}
        className="flex-1"
      >
        <Panel
          id="structured"
          defaultSize="50%"
          minSize="20%"
          className="overflow-y-auto"
        >
          {leftPanel}
        </Panel>

        <Separator className="w-1.5 bg-gray-100 hover:bg-blue-200 active:bg-blue-300 transition-colors cursor-col-resize flex items-center justify-center border-x border-gray-200">
          <div className="h-8 w-0.5 rounded-full bg-gray-300" />
        </Separator>

        <Panel
          id="unstructured"
          defaultSize="50%"
          minSize="20%"
          className="overflow-y-auto"
        >
          {rightPanel}
        </Panel>
      </Group>
    </div>
  );
}
