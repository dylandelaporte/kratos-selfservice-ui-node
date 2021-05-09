import { NextFunction, Request, Response } from 'express'
import config from '../config'
import {AdminApi, Configuration} from '@oryd/kratos-client'

const adminApi = new AdminApi(new Configuration({basePath: config.kratos.admin}))

export default (req: Request, res: Response, next: NextFunction) => {
  const error = req.query.error

  if (!error) {
    // No error was send, redirecting back to home.
    res.redirect(config.baseUrl)
    return
  }

  adminApi
    .getSelfServiceError(error + "")
    .then(response => {
        if (response.status == 404) {
          // The error could not be found, redirect back to home.
          res.redirect(config.baseUrl)
          return
        }

        return response.data
      }
    )
    .then(errorContainer => {
      if (errorContainer != undefined && 'errors' in errorContainer) {
        res.status(500).render('error', {
          message: JSON.stringify(errorContainer.errors, null, 2),
        })
        return Promise.resolve()
      }

      return Promise.reject(
        `expected errorContainer to contain "errors" but got ${JSON.stringify(
          errorContainer
        )}`
      )
    })
    .catch(err => next(err))
}
