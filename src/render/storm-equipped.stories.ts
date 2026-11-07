import type { Meta, StoryObj } from '@storybook/html-vite';
import { equippedBowFixture } from './equipped-bow-fixture.ts';
const meta={title:'Arena/Storm equipped',render:()=>equippedBowFixture(1)} satisfies Meta;
export default meta;
export const Candidate:StoryObj={};
