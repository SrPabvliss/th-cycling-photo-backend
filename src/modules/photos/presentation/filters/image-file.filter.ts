import { BadRequestException } from '@nestjs/common'
import { ALLOWED_MIME_TYPES } from '../constants/upload.constants'

export const imageFileFilter = (
  _req: unknown,
  file: Express.Multer.File,
  callback: (error: Error | null, acceptFile: boolean) => void,
) => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    callback(null, true)
  } else {
    callback(
      new BadRequestException(
        `File type ${file.mimetype} is not allowed. Accepted: JPEG, PNG, WebP`,
      ),
      false,
    )
  }
}
