import { Request, Response } from 'express';
import prisma from '../config/db';

export const logPrinterConnection = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { printerName, deviceAddress, platform, connectionType } = req.body;

    if (!printerName || typeof printerName !== 'string' || !printerName.trim()) {
      return res.status(400).json({ error: 'printerName is required and must be non-empty' });
    }

    const rawPrinterName = printerName.trim();
    const cleanPlatform = platform === 'mobile' ? 'mobile' : 'web';
    const cleanConnectionType = connectionType && typeof connectionType === 'string' ? connectionType.trim() : 'bluetooth';
    const cleanDeviceAddress = deviceAddress && typeof deviceAddress === 'string' ? deviceAddress.trim() : null;

    const log = await prisma.printerLog.create({
      data: {
        userId,
        printerName: rawPrinterName,
        deviceAddress: cleanDeviceAddress,
        platform: cleanPlatform,
        connectionType: cleanConnectionType,
      },
    });

    return res.status(201).json({
      success: true,
      log,
    });
  } catch (error) {
    console.error('Error logging printer connection:', error);
    return res.status(500).json({
      error: 'Failed to log printer connection',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
