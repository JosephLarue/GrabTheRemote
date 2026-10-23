import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('./env', () => ({ env: () => ({ IP_HASH_SECRET: 'test-secret-test-secret' }) }));

const { ipKey, ipHash } = await import('./ip');

describe('ipKey', () => {
  it('keeps IPv4 as-is', () => expect(ipKey('203.0.113.7')).toBe('203.0.113.7'));
  it('unwraps IPv4-mapped IPv6', () => expect(ipKey('::ffff:203.0.113.7')).toBe('203.0.113.7'));
  it('reduces IPv6 to /64', () => {
    expect(ipKey('2001:db8:abcd:12::1')).toBe('2001:0db8:abcd:0012::/64');
    expect(ipKey('2001:db8:abcd:12:ffff:ffff:ffff:ffff')).toBe('2001:0db8:abcd:0012::/64');
  });
});

describe('ipHash', () => {
  it('is stable within a /64 and differs across', () => {
    const h = (ip: string) => ipHash(new Headers({ 'cf-connecting-ip': ip }));
    expect(h('2001:db8:abcd:12::1')).toBe(h('2001:db8:abcd:12::beef'));
    expect(h('2001:db8:abcd:12::1')).not.toBe(h('2001:db8:abcd:13::1'));
    expect(h('203.0.113.7')).not.toContain('203');
  });
});
