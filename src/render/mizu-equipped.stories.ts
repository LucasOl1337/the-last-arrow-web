import type { Meta, StoryObj } from '@storybook/html-vite';
import { equippedBowFixture } from './equipped-bow-fixture.ts';
const meta={title:'Arena/Mizu equipped candidate',render:()=>equippedBowFixture(0)} satisfies Meta;
export default meta;
export const Candidate:StoryObj={};
