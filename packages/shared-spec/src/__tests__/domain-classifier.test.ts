import { describe, it, expect } from 'vitest';
import { classifyVideoDomain } from '../schema.js';

describe('Dynamic Video Domain Classifier (classifyVideoDomain)', () => {
  it('should correctly classify BATTLE campaigns', () => {
    expect(
      classifyVideoDomain('Tóm tắt cuộc hành quân thần tốc của Hoàng đế Quang Trung đại phá quân Thanh')
    ).toBe('BATTLE');

    expect(
      classifyVideoDomain('Chiến dịch Điện Biên Phủ lừng lẫy năm châu')
    ).toBe('BATTLE');

    expect(
      classifyVideoDomain('Trận chiến Bạch Đằng năm 938 của Ngô Quyền')
    ).toBe('BATTLE');
  });

  it('should correctly classify BIOGRAPHY for historical figures', () => {
    expect(
      classifyVideoDomain('Cuộc đời và sự nghiệp của Đại tướng Võ Nguyên Giáp')
    ).toBe('BIOGRAPHY');

    expect(
      classifyVideoDomain('Tiểu sử Chủ tịch Hồ Chí Minh')
    ).toBe('BIOGRAPHY');
  });

  it('should correctly classify DYNASTY', () => {
    expect(
      classifyVideoDomain('Chiếu dời đô và Triều đại Nhà Lý')
    ).toBe('DYNASTY');

    expect(
      classifyVideoDomain('Sự hưng thịnh của Triều đại Nhà Trần')
    ).toBe('DYNASTY');
  });

  it('should correctly classify MYSTERY', () => {
    expect(
      classifyVideoDomain('Bí ẩn vụ án Lệ Chi Viên của Nguyễn Trãi')
    ).toBe('MYSTERY');
  });

  it('should correctly classify ARTIFACT', () => {
    expect(
      classifyVideoDomain('Trống đồng Đông Sơn bảo vật quốc gia')
    ).toBe('ARTIFACT');
  });

  it('should honor explicit videoType if provided', () => {
    expect(
      classifyVideoDomain('Tóm tắt cuộc hành quân thần tốc', 'BIOGRAPHY')
    ).toBe('BIOGRAPHY');
  });
});
