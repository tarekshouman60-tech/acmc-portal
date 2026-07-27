import React from 'react'

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }
  static getDerivedStateFromError(error) {
    return { error }
  }
  componentDidCatch(error, info) {
    console.error('Page crashed:', error, info)
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{padding:40,textAlign:'center'}}>
          <div style={{fontSize:15,fontWeight:600,marginBottom:8}}>Something went wrong loading this page.</div>
          <div style={{fontSize:13,color:'#8898aa',marginBottom:16}}>{this.state.error.message}</div>
          <button onClick={()=>{this.setState({error:null}); this.props.onReset?.()}}
            style={{padding:'8px 18px',borderRadius:7,border:'none',background:'#155eef',color:'#fff',cursor:'pointer',fontSize:13,fontWeight:600}}>
            ← Back to Dashboard
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
