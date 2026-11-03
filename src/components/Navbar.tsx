import React from 'react';
export type { TabType } from './Sidebar';
export { Sidebar } from './Sidebar';

// Backwards compatibility export
import { Sidebar } from './Sidebar';
export const Navbar = Sidebar;
