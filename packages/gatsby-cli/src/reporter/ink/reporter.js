import React from "react"
import { Static, Box } from "ink"
import { globalTracer } from "opentracing"
import util from "util"
import Activity, { calcElapsedTime } from "./components/activity"
import { Message } from "./components/messages"

const tracer = globalTracer()

export default class GatsbyReporter extends React.Component {
  verbose = process.env.gatsby_log_level === `verbose`
  state = {
    verbose: false,
    messages: [],
    activities: {},
  }

  createActivity = (name, activityArgs) => {
    const { parentSpan } = activityArgs
    const spanArgs = parentSpan ? { childOf: parentSpan } : {}
    const span = tracer.startSpan(name, spanArgs)

    return {
      start: () => {
        this.setState(state => {
          return {
            activities: {
              ...state.activities,
              [name]: {
                status: ``,
                startTime: process.hrtime(),
              },
            },
          }
        })
      },
      setStatus: status => {
        this.setState(state => {
          const activity = state.activities[name]

          return {
            activities: {
              ...state.activities,
              [name]: {
                ...activity,
                status: status,
              },
            },
          }
        })
      },
      end: () => {
        span.finish()
        const activity = this.state.activities[name]

        let successText = `${name} - ${calcElapsedTime(activity.startTime)} s`
        if (activity.status) {
          successText += ` — ${activity.status}`
        }

        this.onSuccess(successText)

        this.setState(state => {
          const activities = { ...state.activities }
          delete activities[name]

          return {
            activities,
          }
        })
      },
      span,
    }
  }

  setColors(useColors = false) {
    this.setState({
      disableColors: !useColors,
    })
  }

  setVerbose(isVerbose = true) {
    this.verbose = isVerbose
  }

  _addMessage(type, ...args) {
    let str = util.format(...args)

    // threat null/undefind as an empty character, it seems like ink can't handle empty str
    if (!str) {
      str = `\u2800`
    }

    this.setState(state => {
      return {
        messages: [
          ...state.messages,
          {
            text: str,
            type,
          },
        ],
      }
    })
  }

  onLog = this._addMessage.bind(this, null)
  onInfo = this._addMessage.bind(this, `info`)
  onSuccess = this._addMessage.bind(this, `success`)
  onWarn = this._addMessage.bind(this, `warn`)
  onVerbose = str => {
    if (!this.verbose) {
      return
    }

    this._addMessage(`verbose`, str)
  }

  render() {
    return (
      <Box flexDirection="column">
        <Box flexDirection="column">
          <Static>
            {this.state.messages.map((msg, index) => (
              <Box textWrap="wrap" key={index}>
                <Message type={msg.type} hideColors={this.state.disableColors}>
                  {msg.text}
                </Message>
              </Box>
            ))}
          </Static>

          <Box flexDirection="column" marginTop={1}>
            {Object.keys(this.state.activities).map(activityName => (
              <Activity
                key={activityName}
                name={activityName}
                {...this.state.activities[activityName]}
              />
            ))}
          </Box>
        </Box>
      </Box>
    )
  }
}
