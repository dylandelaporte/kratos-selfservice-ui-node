import {NextFunction, Request, Response} from 'express'
import config from '../config'
import {AdminApi, Configuration} from '@oryd/kratos-client'

const adminApi = new AdminApi(new Configuration({basePath: config.kratos.admin}))

const settingsHandler = (req: Request, res: Response, next: NextFunction) => {
  const request = req.query.flow
  // The request is used to identify the login and registraion request and
  // return data like the csrf_token and so on.
  if (!request) {
    console.log('No request found in URL, initializing flow.')
    res.redirect(`${config.kratos.browser}/self-service/browser/flows/settings`)
    return
  }

  adminApi.getSelfServiceSettingsFlow(request + "")
    .then(response => {
      if (response.status == 404 || response.status == 410 || response.status == 403) {
        res.redirect(
          `${config.kratos.browser}/self-service/browser/flows/settings`
        )
        return
      } else if (response.status != 200) {
        return Promise.reject(response.data)
      }

      return Promise.resolve(response.data)
    })
    .then(request => {
      const methodConfig = (key: string) => request?.methods[key]?.config

      if (request) {
        res.render('settings', {
          ...request,
          password: methodConfig("password"),
          profile: methodConfig("profile"),
          oidc: methodConfig("oidc"),
        })
        return
      }

      return Promise.reject(
        'Expected self service settings request to be defined.'
      )
    })
    .catch(err => {
      console.error(err)
      next(err)
    })
}

export default settingsHandler
