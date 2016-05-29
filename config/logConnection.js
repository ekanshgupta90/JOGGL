/**
 * JOGGL@./config/logConnection.jss
 * @author egupta
 * @description Logger connection details.
 */

module.exports = function (winston) {
	winston.add (
			winston.transports.File, {
				filename : './logs/logger.log',
				level : 'info',
				json : false,
				eol : '\n',
				handleExceptions : true,
				timestamp : true
			}
	);
}