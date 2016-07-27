(function($){
	class TailF {
		/**
		 * Tailer Constructor
		 *
		 * @param 	{function,object}		firstParam 				Either an attainer function, or an object containing the parameter values
		 * @param 	{function,undefined}	parser 					Either a parser function, or undefined (if attainer is an object)
		 * @param 	{number} 				interval 				Tail interval (in milliseconds)
		 * @param 	{boolean,number}		staleLimit				If no new data is pulled after this value of iterations, then consider it stale data, 
		 * 															and stop polling. false/0 disables this
		 * @param 	{boolean} 				manualInit				If true, then the tail wont auto initiate, Tail.init() will need to be executed
		 * @param 	{string} 				method					Set the polling method:
		 * 																manual: a callback is executed;
		 * 																synchronous: setInterval will skip an iteration unless the previous one is finished;
		 *																asynchronous: execute the next iteration regardless of the last iteration (default)
		 * @param 	{debug} 				debug 					Enable debugging
		 * @var 	{function} 				firstParam.attainer 	Attainer function for retrieving data
		 * @var 	{function} 				firstParam.parser 		Parser function for parsing the attainer output
		 * @var 	{number}				firstParam.interval 	Interval to execute attainer/parser
		 * @var 	{boolean,number}		firstParam.staleLimit 	If no new data is pulled after this value of iterations, then consider it stale data, 
		 * 															and stop polling. false/0 disables this
		 * @var 	{boolean}				firstParam.manualInit	If true, then the Tail.init() wont be executed when the object is initiated, it 
		 * 															must be started manually
		 * @var 	{boolean} 				firstParam.method 		Set the polling method:
		 * 																manual: a callback is executed;
		 * 																synchronous: setInterval will skip an iteration unless the previous one is finished;
		 *																asynchronous: execute the next iteration regardless of the last iteration (default)
		 * @var 	{boolean}				firstParam.debug 		Set debugger output
		 * @todo 	Methods to allow attainer to manually set the iteration to finished (Or just a callback param?)
		 * @todo 	Add the 'starting' parameter (equiv to tail -f -n N)
		 */
		constructor ( firstParam, parser, interval, staleLimit, manualInit, method, debug ){
			if( firstParam === undefined )
				throw "Expected first parameter to be an object or function"

			var allowedMethods = [ 'manual', 'synchronous', 'asynchronous' ]

			// Set defaults
			this._interval 		= 3000
			this._staleLimit 	= false
			this._loop 			= undefined
			this._loopInt		= null
			this._debug			= false
			this._force 		= false
			this._sync			= false
			this._buffer 		= {}
			this._method		= 'async' // manual, async, sync

			if( typeof firstParam === 'object' ){

				if( typeof firstParam.attainer !== 'function' )
					throw "Expected attainer to be a function - typeof returned: " + typeof firstParam.attainer

				if( typeof firstParam.parser !== 'function' )
					throw "Expected parser to be a function - typeof returned: " + typeof firstParam.parser

				this._attainer 	= firstParam.attainer
				this._parser   	= firstParam.parser

				if( firstParam.interval !== undefined && typeof firstParam.interval === 'number' )
					this._interval = firstParam.interval

				if( firstParam.staleLimit !== undefined && typeof firstParam.staleLimit === 'number' )
					this._staleLimit = firstParam.staleLimit

				if( firstParam.force !== undefined && typeof firstParam.force === 'boolean' )
					this._force = firstParam.force

				if( firstParam.debug !== undefined && typeof firstParam.debug === 'boolean' )
					this._debug = firstParam.debug

				//if( firstParam.synchronous !== undefined && typeof firstParam.synchronous === 'boolean' )
				//	this._sync = firstParam.synchronous

				if( firstParam.method !== undefined && $.inArray( firstParam.method, allowedMethods ) !== -1 )
					this._method = firstParam.method

				manualInit = ( firstParam.manualInit !== undefined && firstParam.manualInit === true )
			}
			else {
				if( typeof firstParam !== 'function' )
					throw "Expected attainer to be a function - typeof returned: " + typeof firstParam

				if( typeof parser !== 'function' )
					throw "Expected parser to be a function - typeof returned: " + typeof parser

				// attainer, procure, obtain, acquire
				this._attainer 	= firstParam
				this._parser   	= parser

				if( interval !== undefined && typeof interval === 'number' )
					this._interval = interval

				if( staleLimit !== undefined && typeof staleLimit === 'number' )
					this._staleLimit = staleLimit

				if( force !== undefined && typeof force === 'boolean' )
					this._force = force

				//if( synchronous !== undefined && typeof synchronous === 'boolean' )
				//	this._sync = synchronous

				if( method !== undefined && $.inArray( method, allowedMethods ) !== -1 )
					this._method = method

				if( debug !== undefined && typeof debug === 'boolean' )
					this._debug = debug

				manualInit = !!manualInit
			}

			// Initiate the polling, unless manualInit is enabled
			if( manualInit !== true )
				this.init()
		}

		/**
		 * Set the attainer function of a Tail instance
		 *
		 * @param 	{function}	func 	Set the attainer function. If the function passed is the same 
		 * 								as the current attainer function, then nothing will be changed
		 */
		set attainer( func ){
			if( func.toString( ) == this._attainer.toString( ) ){
				console.warn( 'New attainer and old attainer are identical' )
				return false
			}

			this.status = false
			this._attainer = func
			this.status = true
		}

		/**
		 * Set the 
		 */
		set interval( interval ){
			if( interval === this._interval ){
				console.warn( 'The interval is already %s - changing nothing', interval )
			}
			else {
				console.log('Setting interval to %s', interval)

				this.status = false
				this._interval = interval
				this.status = true
			}
		}

		/**
		 * Get the number of times a specific Tail object instance has executed the attainer/parser
		 *
		 * @return 	{null,number} 	Number of iterations, or null if disabled
		 */
		get iterations(){
			return this._loop
		}

		/**
		 * Set the force value for any errors thrown in the setInterval() loop.
		 *
		 * @param 	{boolean} 	force 	True/False, representing the desired force value
		 */
		set force( force ){
			this._force = force
		}

		/**
		 * Get the force value of the object
		 *
		 * @return 	{boolean} 	True/False, representing the force value
		 */
		get force( ){
			return this._force
		}

		/**
		 * Set the stale limit count value
		 *
		 * @param 	{boolean,number} 	staleLimit 	Either false to disable staleLimit, or a number (greater than 0) 
		 * 											to terminate polling after n stale data retrevals
		 */
		set staleLimit( staleLimit ){
			if( staleLimit === 0 )
				staleLimit = false

			this._staleLimit = staleLimit
		}

		/**
		 * Get the stale limit count value
		 *
		 * @return 	{boolean,number} 	False if staleLimit is disabled, otherwise, a numeric value
		 */
		get staleLimit( ){
			return this._staleLimit
		}

		/**
		 * Set the instances setInterval status
		 *
		 * @param 	{boolean} 	status 		True/False to enable/disable loop
		 */
		set status( status ){
			if( status ){
				if( this._loopInt === null ){
					console.debug('loopInt is null')
					this._loopInt = 0
					this.init()
				}
				else {
					console.warn( 'Attainer is already running! Doing nothing' )
				}
				
			}
			else {
				if( typeof this._loopInt === 'number' ){
					console.debug('loopInt is a number')
					clearInterval( this._loop )
					//this._loop = undefined
					this._loopInt = null
				}
				else {
					console.warn( 'Attainer is already stopped! Doing nothing' )
				}
			}	
		}

		/**
		 * Get the status of the loop
		 * 
		 * @return {boolean,number}		Returns false if stopped, or iteration number if its running
		 */
		get status(){
			// If the loopInt(erval) isnt null, then its running			
			return this._loopInt !== null
		}

		/**
		 * Tail initiation
		 *
		 * @todo Try to use a promise for the iterations (instead of callbacks), to better assure (a)synchronous behavior
		 */
		init(){
			var executing = false,
				staleLimit = 0,
				attained

			this._loopInt = 0

			this._loop = setInterval(() => {
				// Check if theres already something in progress
				if( executing === true && this._sync === true ){
					console.log( 'Loop iteration already in progress and asynchronous is false - skipping this iteration' )
					return
				}

				executing = true

				// Try to execute the attainer function
				try {
					attained = this._attainer()
					/*
					if( this._method === 'manual' ){
						// Callback?
						//var attained = this._attainer()
					}
					else if( this._method === 'async' ){

					}
					else if( this._method === 'sync' ){
				    	attained = this._attainer()
				    	//console.debug('Attained:',attained)
					}
					else {
						throw "Unknown polling method '%s' - Expecting manual, async or sync"
					}
					*/
				}
				catch( err ) {
					console.error('Error executing attainer function: %s', ( typeof err.message !== 'undefined' ? err.message : 'Unknown error' ) )

					if( this._force === false )
						this.status = false
				}

				if( typeof attained !== 'string' )
					throw 'Expected attainer to return a string value - received a typeof: %s' + typeof attained 

				// @todo - Need to get empty lines
				// Split the 
				var attainedLinesArr = attained.split( '\n' ),
					newLines = {}

				// Check if the newly attained output is the same length as the current buffer
				if( attainedLinesArr.length !== Object.keys( this._buffer ).length ){
					staleLimit = 0

					// Loop through the attainedLinesArr, starting at one more than the number of keys in the current buffer. Add 
					// the new lines to the newLines object and the buffer (with the line number as the key)
					for( var i = Object.keys( this._buffer ).length; i < attainedLinesArr.length; i++ ){ 
						newLines[ i+1 ]     = attainedLinesArr[ i ] 
						this._buffer[ i+1 ] = attainedLinesArr[ i ] 
					}
				}
				else {
					staleLimit++

					// If there's a staleLimit defined, and its been reached or exceeded, then stop polling
					if( typeof this._staleLimit === 'number' && staleLimit >= this._staleLimit ){
						console.info( 'Terminating polling due to %s stale iterations' )
						this.status = false
					}
					//console.debug('AttainedLinesArr is same as output buffer:')
					//console.log(attainedLinesArr.join('\n'))

					// No new lines from attainer
				}

				// Before any parsing, check if the polling was disabled by some of the above logic
				if( this.status === true ){
					// Try to execute the parser function, providing the attainer output
					try {
					    this._parser( newLines, this._buffer )
					}
					catch( err ) {
						console.error('Error executing parser function: %s', ( typeof err.message !== 'undefined' ? err.message : 'Unknown error' ) )
						
						if( this._force === false )
							this.status = false
					}
				}

				// Unpause the loop (only impacts the loop if this._sync == true)
				executing = false
				
			}, this._interval )
		}
	}

	
	

	$(window).load(function(){
		/*
		// Iniate TailF object using standard parameters
		window.consoleTail = new TailF(
			// Attainer function - Just gets the value from the textarea
			() => {
				var $console_segments = $( 'pre#out > pre' ),
					$console_finished = $( 'pre.console-output' ),
					content = []

				// If there are any console segments found, then parse those first, as thats the "active" 
				// console (which gets a new <pre> for every update)
				if( $console_segments.length ){
					$.each( $console_segments, function( k, pre ){
						var $rows = $.trim($( pre ).text() ).split( '\n' )
						$.merge( content, $rows )
					})

					return content.join('\n')
				}

				// When the build is finished, and the console is no longer auto-updating, then there wont be 
				// any more pre#out > pre, but rather one pre.console-output with all the console output
				else if( $console_finished.length ){
					return $.trim( $console_finished.text() )
				}
				
				else {
					return ''
				}
			},
			// Parser function - Just logs any new rows
			( newLines, full ) => {
				// If no new lines are found, dont do anything
				if( ! newLines || Object.keys( newLines ).length === 0 )
					return

				// For each new line, print it to the console, with the line number as the prefix
				$.each( newLines, function(lineNo, line){
					console.log( '[%s] %s', lineNo, line)
				})
			}, 
			// Interval
			3000,
			// Manual Iniation
			false,
			// Method
			'synchronous',
			// Debugging
			false
		)
		*/

		// Iniate TailF object passing an object of parameters
		window.consoleTail = new TailF({
			// Attainer function - Just gets the value from the textarea
			attainer: () => {
				var $console_segments = $( 'pre#out > pre' ),
					$console_finished = $( 'pre.console-output' ),
					content = []

				// If there are any console segments found, then parse those first, as thats the "active" 
				// console (which gets a new <pre> for every update)
				if( $console_segments.length ){
					$.each( $console_segments, function( k, pre ){
						var $rows = $.trim($( pre ).text() ).split( '\n' )
						$.merge( content, $rows )
					})

					return content.join('\n')
				}

				// When the build is finished, and the console is no longer auto-updating, then there wont be 
				// any more pre#out > pre, but rather one pre.console-output with all the console output
				else if( $console_finished.length ){
					return $.trim( $console_finished.text() )
				}
				
				else {
					return ''
				}
			},
			
			// Parse the attainer results - Printing each line to the console, with the line number as the prefix
			parser: ( newLines, full ) => {
				// If no new lines are found, dont do anything
				if( ! newLines || Object.keys( newLines ).length === 0 )
					return

				// For each new line, print it to the console, with the line number as the prefix
				$.each( newLines, function(lineNo, line){
					console.log( '[%s] %s', lineNo, line)
				})
			},
			interval 	: 1000,
			force 		: true,
			debug 		: false,
			manualInit	: false,
			method 		: 'synchronous'
		})
	})
})(jQuery)