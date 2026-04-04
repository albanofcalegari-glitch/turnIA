import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common'
import { Request, Response } from 'express'

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx    = host.switchToHttp()
    const res    = ctx.getResponse<Response>()
    const req    = ctx.getRequest<Request>()
    const status = exception instanceof HttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR

    let message: string | string[] = 'Error interno del servidor'
    if (exception instanceof HttpException) {
      const response = exception.getResponse()
      if (typeof response === 'string') {
        message = response
      } else if (typeof response === 'object' && response !== null) {
        const nested = (response as Record<string, unknown>).message
        if (Array.isArray(nested))       message = nested.map(String)
        else if (typeof nested === 'string') message = nested
      }
    }

    res.status(status).json({
      success:    false,
      statusCode: status,
      timestamp:  new Date().toISOString(),
      path:       req.url,
      message,
    })
  }
}
