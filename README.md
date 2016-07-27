# jQuery TailF
A simple ES6 class using jQuery to watch a specified element/content, basicaly something similar to the bash command **[tail -f](http://ss64.com/bash/tail.html)**

## Examples
### Basic Example
This example just grabs the text from pre#log every 1.5 seconds, and shows how many new lines were found via console output

	var tail_basic = new TailF({
		// Attainer function
		attainer: () => {
			return $( 'pre#log' ).text()
		},
		
		// Parse the attainer results - Printing each line to the console, with the line number as the prefix
		parser: ( newLines, fullContent ) => {
			// If no new lines are found, dont do anything
			if( ! newLines || Object.keys( newLines ).length === 0 )
				console.log('No new lines found')

			console.log('There were %s new lines found', Object.keys( newLines ).length)
		},
		interval 	: 1500,
		force 		: true,
		debug 		: false,
		manualInit	: false
	})


### Advanced Example
This example will tail the content of all `<pre>` elements found within the parent `<pre id="out">` element, then outputs the content to the console, with the line number as the prefix

	var tail_advanced = new TailF({
		// Attainer function - Tail/Monitor the combined content of all <pre> elements inside a <pre id="out"> element
		attainer: () => {
			var $segments = $( 'pre#out > pre' ),
				content   = []

			if( ! $segments.length )
				return 

			// Iterate over the <pre> elements found and add the rows to the content array
			$.each( $segments, function( k, pre ){
				var $rows = $.trim($( pre ).text() ).split( '\n' )
				$.merge( content, $rows )
			})

			// Return a concatenated version of the content
			return content.join('\n')
		},
		
		// Parse the attainer results - Printing each line to the console, with the line number as the prefix
		parser: ( newLines, fullContent ) => {
			// If no new lines are found, dont do anything
			if( ! newLines || Object.keys( newLines ).length === 0 )
				return

			// For each new line, print it to the console, with the line number as the prefix
			$.each( newLines, function(lineNo, line){
				$('pre#console').append( '[' + lineNo +'] ' + line + '\n' )
				console.log( '[%s] %s', lineNo, line)
			})
		},
		interval 	: 1000,
		force 		: true,
		debug 		: false,
		manualInit	: false
	})

### More to come!
This was made out of necessity, so it only does what I need it to do, but I will definitely add more features, examples and documentation later
