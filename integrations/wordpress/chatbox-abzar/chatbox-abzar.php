<?php
/**
 * Plugin Name:       ابزارک ChatBox
 * Plugin URI:        https://github.com/hamid67fathi/chatbox
 * Description:       ابزارک چت آنلاین ChatBox — نصب ویجت روی سایت وردپرس بدون کدنویسی.
 * Version:           1.0.0
 * Requires at least: 5.8
 * Requires PHP:      7.4
 * Author:            ChatBox
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       chatbox-abzar
 *
 * @package ChatboxAbzar
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'CHATBOX_ABZAR_VERSION', '1.0.0' );
define( 'CHATBOX_ABZAR_PLUGIN_FILE', __FILE__ );
define( 'CHATBOX_ABZAR_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );

require_once CHATBOX_ABZAR_PLUGIN_DIR . 'includes/class-chatbox-abzar.php';

/**
 * Bootstrap plugin.
 */
function chatbox_abzar_init() {
	Chatbox_Abzar::instance();
}
add_action( 'plugins_loaded', 'chatbox_abzar_init' );

register_activation_hook( __FILE__, array( 'Chatbox_Abzar', 'activate' ) );
