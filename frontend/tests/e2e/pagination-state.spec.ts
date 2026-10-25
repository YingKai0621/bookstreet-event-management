import { expect, test } from '@playwright/test';
import { clampPage, getPageCount, getPageOffset, getPaginationItems, toPageIndex } from '../../src/constants/pagination';

test('pagination uses 1-based pages with one conversion boundary and clamps changed totals/sizes', () => {
  expect(getPageCount(0, 10)).toBe(1);
  expect(getPageCount(80, 10)).toBe(8);
  expect(toPageIndex(1)).toBe(0);
  expect(toPageIndex(8)).toBe(7);
  expect(getPageOffset(8, 10)).toBe(70);
  expect(clampPage(8, getPageCount(23, 10))).toBe(3);
  expect(clampPage(8, getPageCount(23, 5))).toBe(5);
  expect(clampPage(0, 8)).toBe(1);
  expect(clampPage(Number.NaN, 8)).toBe(1);
  expect(getPaginationItems(2, 8)).toEqual([1, 2, 3, 'ellipsis', 8]);
  expect(getPaginationItems(1, 1)).toEqual([1]);
  expect(getPaginationItems(99, 8)).toEqual([1, 'ellipsis', 7, 8]);
});
