import { expect, test } from 'vitest';
import { planUsageCollapse } from './collapse';
const items = ['a', 'b', 'c'].map(id => ({ id, verbose: 100, compact: 50 }));
test('verbose, compact and right-to-left overflow preserve provider order', () => {
 expect(planUsageCollapse(300, items, 20)).toEqual({ mode: 'verbose', collapsed: [] });
 expect(planUsageCollapse(150, items, 20)).toEqual({ mode: 'compact', collapsed: [] });
 expect(planUsageCollapse(120, items, 20)).toEqual({ mode: 'compact', collapsed: ['c'] });
 expect(planUsageCollapse(70, items, 20)).toEqual({ mode: 'compact', collapsed: ['b', 'c'] });
 expect(planUsageCollapse(20, items, 20)).toEqual({ mode: 'compact', collapsed: ['a', 'b', 'c'] });
 expect(planUsageCollapse(0, items, 20)).toEqual({ mode: 'compact', collapsed: ['a', 'b', 'c'] });
 expect(planUsageCollapse(0, [], 20)).toEqual({ mode: 'verbose', collapsed: [] });
});
