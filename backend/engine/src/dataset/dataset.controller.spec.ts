import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DatasetController } from './dataset.controller';

const makeMockService = () => ({
  buildLatestDataset: jest.fn().mockResolvedValue({ sources: [] }),
  buildSourceDataset: jest.fn().mockResolvedValue(null),
});

const makeMockExport = () => ({
  readLatestFromDisk: jest.fn().mockResolvedValue(null),
});

const makeMockSource = () => ({
  listSources: jest.fn().mockResolvedValue([]),
});

describe('DatasetController — source key validation', () => {
  let controller: DatasetController;

  beforeEach(() => {
    controller = new DatasetController(
      makeMockService() as any,
      makeMockExport() as any,
      makeMockSource() as any,
    );
  });

  it('rejects keys with path-traversal characters', async () => {
    await expect(
      controller.getSourceDataset('../etc/passwd'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects keys exceeding 64 characters', async () => {
    const longKey = 'a'.repeat(65);
    await expect(
      controller.getSourceDataset(longKey),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects keys with special characters', async () => {
    await expect(
      controller.getSourceDataset('key; DROP TABLE'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('accepts valid alphanumeric keys', async () => {
    const datasetService = makeMockService();
    datasetService.buildSourceDataset.mockResolvedValue({ key: 'valid-key' });
    controller = new DatasetController(
      datasetService as any,
      makeMockExport() as any,
      makeMockSource() as any,
    );
    const result = await controller.getSourceDataset('valid-key_123');
    expect(result).toEqual({ key: 'valid-key' });
  });

  it('throws NotFoundException for a valid key that does not exist', async () => {
    await expect(
      controller.getSourceDataset('missing'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
